import { db } from "../config/database";
import { eq, and, inArray, notInArray, gt, gte } from "drizzle-orm";
import { matches, matchSides, tournamentEntries, tournamentEntryPlayers } from "../db/schema";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import type { Discipline, MmrAnimationEventReason, MmrHistoryOutcome, OutcomeType } from "@skill-arena/shared";

export interface SidePlayerInput {
  id: string;
  currentMmr: number;
}

export interface SideInput {
  sideId?: string;
  isWinner: boolean | null; // null = draw
  players: SidePlayerInput[];
  score?: number;
}

export interface MatchCalculationInput {
  discipline: Discipline;
  outcomeType: OutcomeType;
  sides: [SideInput, SideInput];
  kFactor?: number;
  isPlacement?: boolean;
}

export interface PlayerMmrOutput {
  playerId: string;
  mmrDelta: number;
  newMmr: number;
}

interface MatchSideData {
  opponentPlayerIds: string[];
  sameTeamPlayerIds: string[];
  scoreForPlayer: number;
  scoreForOpponent: number;
  playerWon: boolean | null;
}

interface CheckpointState {
  mmr: number;
  wins: number;
  losses: number;
  winStreak: number;
  maxWinStreak: number;
}

interface MmrLookups {
  sidesMap: Map<string, MatchSideData>;
  historiesMap: Map<string, number>;
  currentMmrMap: Map<string, number>;
}

type MatchResult = 1 | 0 | 0.5;
type ResolvableSide = {
  score: number | null;
  entry?: { players: { playerId: string }[] } | null;
};

function outcomeFromWin(playerWon: boolean | null): MmrHistoryOutcome {
  if (playerWon === true) return "win";
  if (playerWon === false) return "loss";
  return "draw";
}

export class MmrCalculationService {
  calculateExpectedScore(playerMmr: number, opponentMmr: number): number {
    return 1 / (1 + Math.pow(10, (opponentMmr - playerMmr) / 400));
  }

  calculateEffectiveK(
    kBase: number,
    scoreA: number,
    scoreB: number,
    isPlacement: boolean,
    scoreCountsForMmr: boolean,
    outcomePoints: number | null,
  ): number {
    let k = kBase;
    if (isPlacement) k *= 2;

    if (scoreCountsForMmr) {
      const total = scoreA + scoreB;
      if (total > 0) {
        const winner = Math.max(scoreA, scoreB);
        const loser = Math.min(scoreA, scoreB);
        k = k * (1 + (winner - loser) / total);
      }
    }

    if (outcomePoints !== null) {
      const DEFAULT_OUTCOME_POINTS = 3;
      k = k * (outcomePoints / DEFAULT_OUTCOME_POINTS);
    }

    return k;
  }

  calculateMmrDelta(
    playerMmr: number,
    oppAvgMmr: number,
    result: MatchResult,
    kEffective: number,
  ): number {
    const expected = this.calculateExpectedScore(playerMmr, oppAvgMmr);
    return Math.round(kEffective * (result - expected));
  }

  async recalculatePlayerMmr(seasonId: string, playerId: string, fromPlayedAt?: Date): Promise<void> {
    const config = await rankedSeasonRepository.getConfigByTournamentId(seasonId);
    if (!config) return;

    let checkpoint: CheckpointState | null = null;
    let state: CheckpointState;
    if (fromPlayedAt) {
      checkpoint = await playerMmrRepository.getCheckpointState(seasonId, playerId, fromPlayedAt);
      state = checkpoint ?? { mmr: config.baseMmr, wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
    } else {
      state = { mmr: config.baseMmr, wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
    }

    await playerMmrRepository.deleteMmrHistoryForPlayer(seasonId, playerId, fromPlayedAt);

    const playerMatches = await this.getPlayerMatchesForSeason(seasonId, playerId, fromPlayedAt);

    if (playerMatches.length > 0) {
      const matchIds = playerMatches.map((m) => m.id);
      const sidesMap = await this.preloadMatchSides(matchIds, playerId);
      const allOtherPlayerIds = [...new Set([...sidesMap.values()].flatMap((s) => [...s.opponentPlayerIds, ...(s.sameTeamPlayerIds ?? [])]))];
      const historiesMap = await playerMmrRepository.preloadOpponentHistories(seasonId, matchIds, allOtherPlayerIds);
      const currentMmrMap = await playerMmrRepository.getPlayerCurrentMmrs(seasonId, allOtherPlayerIds);

      for (const match of playerMatches) {
        state = await this.processOneMatch(match, playerId, seasonId, config, state, {
          sidesMap,
          historiesMap,
          currentMmrMap,
        });
      }
    }

    if (playerMatches.length === 0 && checkpoint === null) {
      await playerMmrRepository.deleteBySeasonAndPlayer(seasonId, playerId);
      return;
    }

    await playerMmrRepository.upsert({
      seasonId,
      playerId,
      currentMmr: state.mmr,
      matchesPlayed: state.wins + state.losses,
      wins: state.wins,
      losses: state.losses,
      winStreak: state.winStreak,
      maxWinStreak: state.maxWinStreak,
    });
  }

  private async processOneMatch(
    match: Awaited<ReturnType<typeof this.getPlayerMatchesForSeason>>[number],
    playerId: string,
    seasonId: string,
    config: { baseMmr: number; kFactor: number; placementMatches: number },
    state: CheckpointState,
    lookups: MmrLookups,
  ): Promise<CheckpointState> {
    const { sidesMap, historiesMap, currentMmrMap } = lookups;
    const isPlacement = state.wins + state.losses < config.placementMatches;
    const raw = sidesMap.get(match.id) ?? { opponentPlayerIds: [], sameTeamPlayerIds: [], scoreForPlayer: 0, scoreForOpponent: 0, playerWon: null };
    const { opponentPlayerIds, playerWon } = raw;
    const sameTeamPlayerIds = raw.sameTeamPlayerIds ?? [];

    const getOtherPlayerMmr = (id: string) =>
      historiesMap.get(`${id}:${match.id}`) ?? currentMmrMap.get(id) ?? config.baseMmr;

    const mySidePlayers: SidePlayerInput[] = [
      { id: playerId, currentMmr: state.mmr },
      ...sameTeamPlayerIds.map((id) => ({ id, currentMmr: getOtherPlayerMmr(id) })),
    ];
    const oppSidePlayers: SidePlayerInput[] = opponentPlayerIds.map((id) => ({
      id,
      currentMmr: getOtherPlayerMmr(id),
    }));

    const outcomeType = match.outcomeType ?? { id: "", disciplineId: "", name: "", isDefault: false, scoreCountsForMmr: true, points: 3, mmrMultiplier: 1, discipline: null };
    const discipline = outcomeType.discipline ?? { id: "", name: "", teamInteractionMode: null };

    const calcResults = this.calculateMatchMmrBySides({
      discipline,
      outcomeType,
      sides: [
        { isWinner: playerWon, players: mySidePlayers, score: raw.scoreForPlayer },
        { isWinner: playerWon === null ? null : !playerWon, players: oppSidePlayers, score: raw.scoreForOpponent },
      ],
      kFactor: config.kFactor,
      isPlacement,
    });

    const playerResult = calcResults.find((r) => r.playerId === playerId);
    const delta = playerResult?.mmrDelta ?? 0;
    const mmrBefore = state.mmr;
    const mmrAfter = playerResult?.newMmr ?? Math.max(1, state.mmr + delta);
    const opponentAvgMmr = oppSidePlayers.length > 0
      ? Math.round(oppSidePlayers.reduce((s, p) => s + p.currentMmr, 0) / oppSidePlayers.length)
      : config.baseMmr;
    const kEffective = this.calculateEffectiveK(
      config.kFactor,
      raw.scoreForPlayer,
      raw.scoreForOpponent,
      isPlacement,
      outcomeType.scoreCountsForMmr,
      null,
    ) * outcomeType.mmrMultiplier;

    await playerMmrRepository.createMmrHistory({
      seasonId,
      playerId,
      matchId: match.id,
      mmrBefore,
      mmrAfter,
      mmrDelta: delta,
      kEffective,
      opponentAvgMmr,
      isPlacement,
      outcome: outcomeFromWin(playerWon),
    });

    return this.advanceState(state, playerWon, mmrAfter);
  }

  private averageOpponentMmr(
    opponentPlayerIds: string[],
    matchId: string,
    historiesMap: Map<string, number>,
    currentMmrMap: Map<string, number>,
    baseMmr: number,
  ): number {
    if (opponentPlayerIds.length === 0) return baseMmr;
    const total = opponentPlayerIds.reduce((sum, oppId) => {
      const mmr =
        historiesMap.get(`${oppId}:${matchId}`) ?? currentMmrMap.get(oppId) ?? baseMmr;
      return sum + mmr;
    }, 0);
    return Math.round(total / opponentPlayerIds.length);
  }

  private advanceState(
    state: CheckpointState,
    playerWon: boolean | null,
    mmrAfter: number,
  ): CheckpointState {
    const newState: CheckpointState = { ...state, mmr: mmrAfter };
    if (playerWon === true) {
      newState.wins = state.wins + 1;
      newState.winStreak = state.winStreak + 1;
      newState.maxWinStreak = Math.max(state.maxWinStreak, newState.winStreak);
    } else if (playerWon === false) {
      newState.losses = state.losses + 1;
      newState.winStreak = 0;
    }
    return newState;
  }

  async processMatchFinalization(matchId: string): Promise<void> {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: {
        tournament: {
          with: {
            rankedConfig: true,
          },
        },
      },
    });

    if (!match || match.tournament?.mode !== "ranked") return;

    const seasonId = match.tournamentId;
    const playerIds = await this.getMatchPlayerIds(matchId);

    for (const playerId of playerIds) {
      await this.ensurePlayerMmrExists(seasonId, match.tournament.rankedConfig?.baseMmr ?? 1000, playerId);
      await this.recalculatePlayerMmr(seasonId, playerId, match.playedAt);
    }
  }

  async cascadeRecalculateAfterCancellation(
    matchId: string,
    seasonId: string,
    cancelledMatchPlayedAt: Date,
  ): Promise<Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>> {
    const result = new Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>();
    const directPlayerIds = await this.getMatchPlayerIds(matchId);
    const processedIds = new Set<string>(directPlayerIds);

    let changedIds = await this.recalcWaveAndCollectChanges(
      seasonId,
      directPlayerIds,
      cancelledMatchPlayedAt,
      "match_cancelled",
      result,
    );

    while (changedIds.length > 0) {
      const nextWave = await this.findAffectedPlayers(seasonId, changedIds, cancelledMatchPlayedAt, [...processedIds]);
      if (nextWave.length === 0) break;

      for (const playerId of nextWave) processedIds.add(playerId);

      changedIds = await this.recalcWaveAndCollectChanges(
        seasonId,
        nextWave,
        cancelledMatchPlayedAt,
        "cascade",
        result,
      );
    }

    return result;
  }

  private async recalcWaveAndCollectChanges(
    seasonId: string,
    playerIds: string[],
    playedAt: Date,
    reason: MmrAnimationEventReason,
    result: Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>,
  ): Promise<string[]> {
    const snapshots = new Map<string, number>();
    for (const playerId of playerIds) {
      const record = await playerMmrRepository.getBySeasonAndPlayer(seasonId, playerId);
      snapshots.set(playerId, record?.currentMmr ?? 0);
    }

    for (const playerId of playerIds) {
      await this.recalculatePlayerMmr(seasonId, playerId, playedAt);
    }

    const changedIds: string[] = [];
    for (const playerId of playerIds) {
      const record = await playerMmrRepository.getBySeasonAndPlayer(seasonId, playerId);
      const mmrAfter = record?.currentMmr ?? 0;
      const mmrBefore = snapshots.get(playerId) ?? 0;
      result.set(playerId, { mmrBefore, mmrAfter, reason });
      if (mmrAfter !== mmrBefore) changedIds.push(playerId);
    }
    return changedIds;
  }

  private async findAffectedPlayers(
    seasonId: string,
    changedPlayerIds: string[],
    afterPlayedAt: Date,
    excludePlayerIds: string[],
  ): Promise<string[]> {
    const matchRows = await db
      .selectDistinct({ matchId: matchSides.matchId })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .innerJoin(matches, eq(matchSides.matchId, matches.id))
      .where(
        and(
          eq(matches.tournamentId, seasonId),
          eq(matches.status, "finalized"),
          gt(matches.playedAt, afterPlayedAt),
          inArray(tournamentEntryPlayers.playerId, changedPlayerIds),
        ),
      );

    if (matchRows.length === 0) return [];

    const matchIds = matchRows.map((r) => r.matchId);
    const conditions = [inArray(matchSides.matchId, matchIds)];
    if (excludePlayerIds.length > 0) {
      conditions.push(notInArray(tournamentEntryPlayers.playerId, excludePlayerIds));
    }

    const playerRows = await db
      .selectDistinct({ playerId: tournamentEntryPlayers.playerId })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(and(...conditions));

    return playerRows.map((r) => r.playerId);
  }

  private async recalculateBoundaries(seasonId: string, baseMmr: number): Promise<void> {
    const tiers = await rankedSeasonRepository.getRankTiers(seasonId);
    if (tiers.length === 0) return;

    const allPlayers = await playerMmrRepository.getAllPlayersBySeasonId(seasonId);
    const sorted = allPlayers.map((p) => p.currentMmr).sort((a, b) => a - b);
    const n = sorted.length;

    for (const tier of tiers) {
      const minMmr =
        tier.percentile === 0 || n === 0
          ? baseMmr
          : (sorted[Math.floor(n * tier.percentile)] ?? baseMmr);
      await rankedSeasonRepository.upsertRankTier(seasonId, tier.level, { minMmr });
    }
  }

  private async getPlayerMatchesForSeason(seasonId: string, playerId: string, fromPlayedAt?: Date) {
    const playerMatchIds = await db
      .select({ matchId: matchSides.matchId })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(eq(tournamentEntryPlayers.playerId, playerId));

    const ids = playerMatchIds.map((r) => r.matchId);
    if (ids.length === 0) return [];

    return await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, seasonId),
        eq(matches.status, "finalized"),
        inArray(matches.id, ids),
        fromPlayedAt ? gte(matches.playedAt, fromPlayedAt) : undefined,
      ),
      with: {
        outcomeType: {
          with: {
            discipline: true,
          },
        },
      },
      orderBy: (m, { asc }) => [asc(m.playedAt)],
    });
  }

  private async preloadMatchSides(matchIds: string[], playerId: string): Promise<Map<string, MatchSideData>> {
    if (matchIds.length === 0) return new Map();

    const allSides = await db.query.matchSides.findMany({
      where: inArray(matchSides.matchId, matchIds),
      orderBy: (s, { asc }) => [asc(s.position)],
      with: {
        entry: {
          with: {
            players: true,
          },
        },
      },
    });

    const matchRows = await db.query.matches.findMany({
      where: inArray(matches.id, matchIds),
      columns: { id: true, winnerSide: true },
    });
    const winnerSideMap = new Map(matchRows.map((m) => [m.id, m.winnerSide]));

    const sidesByMatch = new Map<string, typeof allSides>();
    for (const side of allSides) {
      const list = sidesByMatch.get(side.matchId) ?? [];
      list.push(side);
      sidesByMatch.set(side.matchId, list);
    }

    const result = new Map<string, MatchSideData>();
    for (const matchId of matchIds) {
      const sides = sidesByMatch.get(matchId);
      if (!sides || sides.length < 2) {
        result.set(matchId, { opponentPlayerIds: [], sameTeamPlayerIds: [], scoreForPlayer: 0, scoreForOpponent: 0, playerWon: null });
        continue;
      }

      const winnerSide = winnerSideMap.get(matchId) ?? null;
      result.set(matchId, this.resolveSideData(sides[0], sides[1], playerId, winnerSide));
    }

    return result;
  }

  private resolveSideData(
    sideA: ResolvableSide,
    sideB: ResolvableSide,
    playerId: string,
    winnerSide: string | null,
  ): MatchSideData {
    const playerIdsA = sideA.entry?.players.map((p) => p.playerId) ?? [];
    const playerIdsB = sideB.entry?.players.map((p) => p.playerId) ?? [];
    const playerInSideA = playerIdsA.includes(playerId);
    const mySide = playerInSideA ? sideA : sideB;
    const oppSide = playerInSideA ? sideB : sideA;

    let playerWon: boolean | null = null;
    if (winnerSide === "A") playerWon = playerInSideA;
    else if (winnerSide === "B") playerWon = !playerInSideA;

    const myIds = playerInSideA ? playerIdsA : playerIdsB;
    const oppIds = playerInSideA ? playerIdsB : playerIdsA;
    return {
      opponentPlayerIds: oppIds,
      sameTeamPlayerIds: myIds.filter((id) => id !== playerId),
      scoreForPlayer: mySide.score ?? 0,
      scoreForOpponent: oppSide.score ?? 0,
      playerWon,
    };
  }

  private async extractMatchSidesForPlayer(
    matchId: string,
    playerId: string,
  ): Promise<{
    opponentPlayerIds: string[];
    scoreForPlayer: number;
    scoreForOpponent: number;
    playerWon: boolean | null;
  }> {
    const sides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, matchId),
      orderBy: (s, { asc }) => [asc(s.position)],
      with: {
        entry: {
          with: {
            players: {
              with: {
                player: true,
              },
            },
          },
        },
      },
    });

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    });

    if (!match || sides.length < 2) {
      return { opponentPlayerIds: [], scoreForPlayer: 0, scoreForOpponent: 0, playerWon: null };
    }

    return this.resolveSideData(sides[0], sides[1], playerId, match.winnerSide);
  }

  private async getMatchPlayerIds(matchId: string): Promise<string[]> {
    const rows = await db
      .select({ playerId: tournamentEntryPlayers.playerId })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(eq(matchSides.matchId, matchId));

    return [...new Set(rows.map((r) => r.playerId))];
  }

  private async ensurePlayerMmrExists(
    seasonId: string,
    baseMmr: number,
    playerId: string,
  ): Promise<void> {
    const existing = await playerMmrRepository.getBySeasonAndPlayer(seasonId, playerId);
    if (!existing) {
      await playerMmrRepository.upsert({
        seasonId,
        playerId,
        currentMmr: baseMmr,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winStreak: 0,
        maxWinStreak: 0,
      });
    }
  }

  calculateMatchMmrBySides(input: MatchCalculationInput): PlayerMmrOutput[] {
    const { discipline, outcomeType, sides, kFactor = 32, isPlacement = false } = input;
    const [side1, side2] = sides;

    if (!outcomeType.scoreCountsForMmr) {
      return [...side1.players, ...side2.players].map((p) => ({
        playerId: p.id,
        mmrDelta: 0,
        newMmr: p.currentMmr,
      }));
    }

    const avg1 = this.sideAvgMmr(side1);
    const avg2 = this.sideAvgMmr(side2);
    const e1 = this.calculateExpectedScore(avg1, avg2);
    const e2 = 1 - e1;
    const k = this.calculateEffectiveK(kFactor, side1.score ?? 0, side2.score ?? 0, isPlacement, outcomeType.scoreCountsForMmr, null);
    const f = outcomeType.mmrMultiplier;
    let w1 = 0.5;
    if (side1.isWinner !== null) w1 = side1.isWinner ? 1 : 0;
    let w2 = 0.5;
    if (side2.isWinner !== null) w2 = side2.isWinner ? 1 : 0;
    const baseDelta1 = k * (w1 - e1) * f;
    const baseDelta2 = k * (w2 - e2) * f;
    const mode = discipline.teamInteractionMode ?? "COLLABORATIVE";

    const mapSide = (side: SideInput, baseDelta: number, oppAvgMmr: number): PlayerMmrOutput[] =>
      side.players.map((p) => {
        const delta = this.distributeToPlayer(baseDelta, p.currentMmr, oppAvgMmr, side.isWinner, mode);
        return { playerId: p.id, mmrDelta: delta, newMmr: Math.max(1, p.currentMmr + delta) };
      });

    return [...mapSide(side1, baseDelta1, avg2), ...mapSide(side2, baseDelta2, avg1)];
  }

  private sideAvgMmr(side: SideInput): number {
    if (side.players.length === 0) return 0;
    return side.players.reduce((sum, p) => sum + p.currentMmr, 0) / side.players.length;
  }

  private distributeToPlayer(
    baseDelta: number,
    playerMmr: number,
    oppAvgMmr: number,
    isWinner: boolean | null,
    mode: NonNullable<Discipline["teamInteractionMode"]>,
  ): number {
    const safeOpp = Math.max(1, oppAvgMmr);
    const safePlayer = Math.max(1, playerMmr);
    if (isWinner === null) return Math.round(baseDelta); // draw → flat
    if (isWinner) return Math.round(baseDelta * (safeOpp / safePlayer));
    if (mode === "INDIVIDUAL") return Math.round(baseDelta * (safePlayer / safeOpp));
    if (mode === "SHARED_RESOURCE") return Math.round(baseDelta * (safeOpp / safePlayer));
    return Math.round(baseDelta); // COLLABORATIVE
  }
}

export const mmrCalculationService = new MmrCalculationService();
