import { db } from "../config/database";
import { eq, and, inArray, notInArray, gt, gte } from "drizzle-orm";
import { matches, matchSides, tournamentEntries, tournamentEntryPlayers } from "../db/schema";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import type { CreateMmrHistoryData } from "../repository/player-mmr.repository";
import { mmrSeedRepository } from "../repository/mmr-seed.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import type { Discipline, MmrAnimationEventReason, MmrHistoryOutcome, OutcomeType } from "@skol-arena/shared";

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
  draws: number;
  winStreak: number;
  maxWinStreak: number;
  lossStreak: number;
  maxLossStreak: number;
}

interface MmrLookups {
  sidesMap: Map<string, MatchSideData>;
  historiesMap: Map<string, number>;
  currentMmrMap: Map<string, number>;
  /** Carried-over entry MMR per player, when the season inherits ranks. */
  entryMmrMap: Map<string, number>;
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

    // A season that carries the previous ranks over starts its players at their
    // seeded MMR, not at baseMmr. Reading it here is what makes the carry-over
    // survive every recalculation instead of being flattened by the first match.
    const entryMmrMap = await mmrSeedRepository.getMapBySeason(seasonId);
    const entryMmr = entryMmrMap.get(playerId) ?? config.baseMmr;

    let checkpoint: CheckpointState | null = null;
    let state: CheckpointState;
    if (fromPlayedAt) {
      checkpoint = await playerMmrRepository.getCheckpointState(seasonId, playerId, fromPlayedAt);
      state = checkpoint ?? { mmr: entryMmr, wins: 0, losses: 0, draws: 0, winStreak: 0, maxWinStreak: 0, lossStreak: 0, maxLossStreak: 0 };
    } else {
      state = { mmr: entryMmr, wins: 0, losses: 0, draws: 0, winStreak: 0, maxWinStreak: 0, lossStreak: 0, maxLossStreak: 0 };
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
          entryMmrMap,
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
      matchesPlayed: state.wins + state.losses + state.draws,
      wins: state.wins,
      losses: state.losses,
      draws: state.draws,
      winStreak: state.winStreak,
      maxWinStreak: state.maxWinStreak,
      lossStreak: state.lossStreak,
      maxLossStreak: state.maxLossStreak,
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
    const { sidesMap, historiesMap, currentMmrMap, entryMmrMap } = lookups;
    const isPlacement = state.wins + state.losses + state.draws < config.placementMatches;
    const raw = sidesMap.get(match.id) ?? { opponentPlayerIds: [], sameTeamPlayerIds: [], scoreForPlayer: 0, scoreForOpponent: 0, playerWon: null };
    const { opponentPlayerIds, playerWon } = raw;
    const sameTeamPlayerIds = raw.sameTeamPlayerIds ?? [];

    const getOtherPlayerMmr = (id: string) =>
      historiesMap.get(`${id}:${match.id}`) ??
      currentMmrMap.get(id) ??
      entryMmrMap.get(id) ??
      config.baseMmr;

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

    const newState = this.advanceState(state, playerWon, mmrAfter);

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
      winStreakAfter: newState.winStreak,
      lossStreakAfter: newState.lossStreak,
      matchesPlayedAfter: newState.wins + newState.losses + newState.draws,
    });

    return newState;
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
      newState.lossStreak = 0;
    } else if (playerWon === false) {
      newState.losses = state.losses + 1;
      newState.winStreak = 0;
      newState.lossStreak = state.lossStreak + 1;
      newState.maxLossStreak = Math.max(state.maxLossStreak, newState.lossStreak);
    } else {
      newState.draws = state.draws + 1;
    }
    return newState;
  }

  async processMatchFinalization(
    matchId: string,
  ): Promise<Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>> {
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

    if (!match || match.tournament?.mode !== "ranked") return new Map();

    const seasonId = match.tournamentId;
    const playerIds = await this.getMatchPlayerIds(matchId);

    for (const playerId of playerIds) {
      await this.ensurePlayerMmrExists(seasonId, match.tournament.rankedConfig?.baseMmr ?? 1000, playerId);
    }

    return this.cascadeRecalculateFromMatch(matchId, seasonId, match.playedAt, "match_finalized");
  }

  async cascadeRecalculateAfterCancellation(
    matchId: string,
    seasonId: string,
    cancelledMatchPlayedAt: Date,
  ): Promise<Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>> {
    return this.cascadeRecalculateFromMatch(matchId, seasonId, cancelledMatchPlayedAt, "match_cancelled");
  }

  /**
   * Generic wave-propagation recalc: recomputes the match's direct participants
   * from fromPlayedAt forward, then repeatedly finds third parties who share
   * later match history with anyone whose MMR just changed and recalculates
   * them too, until nothing changes anymore. Used both for cancellation (undo
   * a match) and normal finalization (a backdated match can change history for
   * players other than its own two direct participants) — the only difference
   * is the reason tag attached to the direct-participant wave.
   */
  private async cascadeRecalculateFromMatch(
    matchId: string,
    seasonId: string,
    fromPlayedAt: Date,
    initialReason: MmrAnimationEventReason,
  ): Promise<Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>> {
    const result = new Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>();
    const directPlayerIds = await this.getMatchPlayerIds(matchId);
    const processedIds = new Set<string>(directPlayerIds);

    let changedIds = await this.recalcWaveAndCollectChanges(
      seasonId,
      directPlayerIds,
      fromPlayedAt,
      initialReason,
      result,
    );

    while (changedIds.length > 0) {
      const nextWave = await this.findAffectedPlayers(seasonId, changedIds, fromPlayedAt, [...processedIds]);
      if (nextWave.length === 0) break;

      for (const playerId of nextWave) processedIds.add(playerId);

      changedIds = await this.recalcWaveAndCollectChanges(
        seasonId,
        nextWave,
        fromPlayedAt,
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

  /**
   * Deterministic full-season MMR recalculation. Unlike the old per-player loop
   * (which read opponent MMR from tables the same loop was concurrently
   * rewriting, making the result depend on arbitrary player iteration order),
   * this replays every finalized match exactly once in a single global
   * chronological pass (playedAt asc, id asc tiebreak), keeping only one
   * in-memory CheckpointState per player. Matches are streamed page by page
   * (keyset pagination) so memory stays bounded by page size + player count,
   * not total match count.
   */
  async recalculateSeasonMmrDeterministic(seasonId: string, pageSize = 500): Promise<void> {
    const config = await rankedSeasonRepository.getConfigByTournamentId(seasonId);
    if (!config) return;

    const existingPlayers = await playerMmrRepository.getAllPlayersBySeasonId(seasonId);
    const existingPlayerIds = new Set(existingPlayers.map((p) => p.playerId));
    // One read for the whole replay: every player's starting MMR, carried over
    // from the previous season when the season inherits ranks.
    const entryMmrMap = await mmrSeedRepository.getMapBySeason(seasonId);

    await playerMmrRepository.deleteAllMmrHistoryForSeason(seasonId);

    const stateMap = new Map<string, CheckpointState>();
    let cursor: { playedAt: Date; id: string } | undefined;

    for (;;) {
      const page = await playerMmrRepository.getFinalizedMatchesPageForSeason(seasonId, cursor, pageSize);
      if (page.length === 0) break;

      const historyBatch: CreateMmrHistoryData[] = [];
      for (const match of page) {
        this.processMatchGlobal(match, seasonId, config, stateMap, historyBatch, entryMmrMap);
      }
      await playerMmrRepository.createMmrHistoryBatch(historyBatch);

      const last = page[page.length - 1];
      cursor = { playedAt: last.playedAt, id: last.id };

      if (page.length < pageSize) break;
    }

    for (const playerId of existingPlayerIds) {
      if (!stateMap.has(playerId)) {
        await playerMmrRepository.deleteBySeasonAndPlayer(seasonId, playerId);
      }
    }

    for (const [playerId, state] of stateMap) {
      await playerMmrRepository.upsert({
        seasonId,
        playerId,
        currentMmr: state.mmr,
        matchesPlayed: state.wins + state.losses + state.draws,
        wins: state.wins,
        losses: state.losses,
        draws: state.draws,
        winStreak: state.winStreak,
        maxWinStreak: state.maxWinStreak,
        lossStreak: state.lossStreak,
        maxLossStreak: state.maxLossStreak,
      });
    }
  }

  /**
   * Same per-player math as processOneMatch (calculateMatchMmrBySides/distributeToPlayer
   * are unchanged), but sources every participant's currentMmr from a single
   * shared in-memory map instead of live DB reads — this is what removes the
   * order-dependency. All reads for a match use the pre-match snapshot; the
   * map is only written once every participant's delta for this match has
   * been computed.
   */
  private processMatchGlobal(
    match: Awaited<ReturnType<typeof playerMmrRepository.getFinalizedMatchesPageForSeason>>[number],
    seasonId: string,
    config: { baseMmr: number; kFactor: number; placementMatches: number },
    stateMap: Map<string, CheckpointState>,
    historyBatch: CreateMmrHistoryData[],
    entryMmrMap: Map<string, number>,
  ): void {
    const sides = match.sides;
    if (!sides || sides.length < 2) return;
    const [sideA, sideB] = sides;
    const sideAIds = sideA.entry?.players.map((p) => p.playerId) ?? [];
    const sideBIds = sideB.entry?.players.map((p) => p.playerId) ?? [];
    const participantIds = [...new Set([...sideAIds, ...sideBIds])];
    if (participantIds.length === 0) return;

    const preState = new Map<string, CheckpointState>();
    for (const id of participantIds) {
      preState.set(
        id,
        stateMap.get(id) ?? {
          mmr: entryMmrMap.get(id) ?? config.baseMmr,
          wins: 0,
          losses: 0,
          draws: 0,
          winStreak: 0,
          maxWinStreak: 0,
          lossStreak: 0,
          maxLossStreak: 0,
        },
      );
    }

    const outcomeType = match.outcomeType ?? { id: "", disciplineId: "", name: "", isDefault: false, scoreCountsForMmr: true, points: 3, mmrMultiplier: 1, discipline: null };
    const discipline = outcomeType.discipline ?? { id: "", name: "", teamInteractionMode: null };
    const getOtherMmr = (id: string) =>
      preState.get(id)?.mmr ?? entryMmrMap.get(id) ?? config.baseMmr;

    for (const playerId of participantIds) {
      const playerState = preState.get(playerId)!;
      const raw = this.resolveSideData(sideA, sideB, playerId, match.winnerSide);
      const { opponentPlayerIds, playerWon } = raw;
      const sameTeamPlayerIds = raw.sameTeamPlayerIds ?? [];
      const isPlacement = playerState.wins + playerState.losses + playerState.draws < config.placementMatches;

      const mySidePlayers: SidePlayerInput[] = [
        { id: playerId, currentMmr: playerState.mmr },
        ...sameTeamPlayerIds.map((id) => ({ id, currentMmr: getOtherMmr(id) })),
      ];
      const oppSidePlayers: SidePlayerInput[] = opponentPlayerIds.map((id) => ({
        id,
        currentMmr: getOtherMmr(id),
      }));

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
      const mmrBefore = playerState.mmr;
      const mmrAfter = playerResult?.newMmr ?? Math.max(1, playerState.mmr + delta);
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

      const newState = this.advanceState(playerState, playerWon, mmrAfter);

      historyBatch.push({
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
        winStreakAfter: newState.winStreak,
        lossStreakAfter: newState.lossStreak,
        matchesPlayedAfter: newState.wins + newState.losses + newState.draws,
      });

      stateMap.set(playerId, newState);
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
      // A carried-over player enters the season at their seeded MMR: this is the
      // row the cascade recalculation starts from.
      const seedMmr = await mmrSeedRepository.getSeedMmr(seasonId, playerId);
      await playerMmrRepository.upsert({
        seasonId,
        playerId,
        currentMmr: seedMmr ?? baseMmr,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winStreak: 0,
        maxWinStreak: 0,
        lossStreak: 0,
        maxLossStreak: 0,
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
