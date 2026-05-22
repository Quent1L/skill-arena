import { db } from "../config/database";
import { eq, and, inArray, notInArray, gt, gte } from "drizzle-orm";
import { matches, matchSides, tournamentEntries, tournamentEntryPlayers } from "../db/schema";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import type { MmrAnimationEventReason, MmrHistoryOutcome } from "@skill-arena/shared";

interface MatchSideData {
  opponentPlayerIds: string[];
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

type MatchResult = 1 | 0 | 0.5;
type ResolvableSide = {
  score: number | null;
  entry?: { players: { playerId: string }[] } | null;
};

function resultFromWin(playerWon: boolean | null): MatchResult {
  if (playerWon === null) return 0.5;
  return playerWon ? 1 : 0;
}

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

    let state: CheckpointState;
    if (fromPlayedAt) {
      const checkpoint = await playerMmrRepository.getCheckpointState(seasonId, playerId, fromPlayedAt);
      state = checkpoint ?? { mmr: config.baseMmr, wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
    } else {
      state = { mmr: config.baseMmr, wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
    }

    await playerMmrRepository.deleteMmrHistoryForPlayer(seasonId, playerId, fromPlayedAt);

    const playerMatches = await this.getPlayerMatchesForSeason(seasonId, playerId, fromPlayedAt);

    if (playerMatches.length > 0) {
      const matchIds = playerMatches.map((m) => m.id);
      const sidesMap = await this.preloadMatchSides(matchIds, playerId);
      const allOpponentIds = [...new Set([...sidesMap.values()].flatMap((s) => s.opponentPlayerIds))];
      const historiesMap = await playerMmrRepository.preloadOpponentHistories(seasonId, matchIds, allOpponentIds);
      const currentMmrMap = await playerMmrRepository.getPlayerCurrentMmrs(seasonId, allOpponentIds);

      for (const match of playerMatches) {
        state = await this.processOneMatch(
          match,
          playerId,
          seasonId,
          config,
          state,
          sidesMap,
          historiesMap,
          currentMmrMap,
        );
      }
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
    sidesMap: Map<string, MatchSideData>,
    historiesMap: Map<string, number>,
    currentMmrMap: Map<string, number>,
  ): Promise<CheckpointState> {
    const isPlacement = state.wins + state.losses < config.placementMatches;
    const { opponentPlayerIds, scoreForPlayer, scoreForOpponent, playerWon } =
      sidesMap.get(match.id) ?? { opponentPlayerIds: [], scoreForPlayer: 0, scoreForOpponent: 0, playerWon: null };

    const scoreCountsForMmr = match.outcomeType?.scoreCountsForMmr ?? true;
    const opponentAvgMmr = this.averageOpponentMmr(
      opponentPlayerIds,
      match.id,
      historiesMap,
      currentMmrMap,
      config.baseMmr,
    );

    const result = resultFromWin(playerWon);
    const kEffective = this.calculateEffectiveK(
      config.kFactor,
      scoreForPlayer,
      scoreForOpponent,
      isPlacement,
      scoreCountsForMmr,
      match.outcomeType?.points ?? null,
    );

    const delta = this.calculateMmrDelta(state.mmr, opponentAvgMmr, result, kEffective);
    const mmrBefore = state.mmr;
    const mmrAfter = Math.max(1, state.mmr + delta);

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
        outcomeType: true,
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
        result.set(matchId, { opponentPlayerIds: [], scoreForPlayer: 0, scoreForOpponent: 0, playerWon: null });
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

    return {
      opponentPlayerIds: playerInSideA ? playerIdsB : playerIdsA,
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
}

export const mmrCalculationService = new MmrCalculationService();
