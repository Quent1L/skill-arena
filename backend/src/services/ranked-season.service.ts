import { eq, and, inArray } from "drizzle-orm";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { tournamentRepository } from "../repository/tournament.repository";
import { userRepository } from "../repository/user.repository";
import { rankedCacheRepository } from "../repository/ranked-cache.repository";
import { mmrCalculationService } from "./mmr-calculation.service";
import { db } from "../config/database";
import { matches, appUsers } from "../db/schema";
import type {
  CreateRankedSeasonInput,
  UpdateRankedSeasonInput,
  ClientPlayerMmr,
  TournamentStatus,
} from "@skill-arena/shared/types/index";
import {
  ErrorCode,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} from "../types/errors";

type ProvisionalOutcome = "win" | "loss" | "draw";
type MatchResult = 1 | 0 | 0.5;
type SeasonPlayers = Awaited<ReturnType<typeof playerMmrRepository.getBySeasonOrdered>>;

interface ProvisionalReplayCtx {
  baseMmr: number;
  kFactor: number;
  provisionalMmr: Map<string, number>;
  provisionalResults: Map<string, { outcome: ProvisionalOutcome }[]>;
}

function countLeadingWins(results: { outcome: string }[]): number {
  let n = 0
  for (const r of results) { if (r.outcome === 'win') n++; else break }
  return n
}

function loadUnfinalizedMatches(seasonId: string) {
  return db.query.matches.findMany({
    where: and(
      eq(matches.tournamentId, seasonId),
      inArray(matches.status, ["reported", "pending_confirmation", "disputed"]),
    ),
    with: {
      outcomeType: { columns: { scoreCountsForMmr: true, points: true } },
      sides: {
        orderBy: (s, { asc }) => [asc(s.position)],
        columns: { position: true, score: true },
        with: {
          entry: {
            columns: { id: true },
            with: { players: { columns: { playerId: true } } },
          },
        },
      },
    },
    orderBy: (m, { asc }) => [asc(m.playedAt)],
  });
}

type UnfinalizedMatch = Awaited<ReturnType<typeof loadUnfinalizedMatches>>[number];

function sideResult(winnerSide: string | null, side: "A" | "B"): MatchResult {
  if (winnerSide === "A") return side === "A" ? 1 : 0;
  if (winnerSide === "B") return side === "B" ? 1 : 0;
  return 0.5;
}

function resultToOutcome(result: MatchResult): ProvisionalOutcome {
  if (result === 1) return "win";
  if (result === 0) return "loss";
  return "draw";
}

export class RankedSeasonService {
  async createSeason(input: CreateRankedSeasonInput, createdBy: string) {
    await this.assertCanManage(createdBy);

    const existing = await rankedSeasonRepository.getActiveSeasonByDiscipline(
      input.disciplineId,
    );
    if (existing) {
      throw new ConflictError(ErrorCode.SEASON_ALREADY_ACTIVE);
    }

    const result = await rankedSeasonRepository.create(
      {
        name: input.name,
        description: input.description,
        disciplineId: input.disciplineId,
        startDate: input.startDate,
        endDate: input.endDate,
        minTeamSize: input.minTeamSize,
        maxTeamSize: input.maxTeamSize,
        rulesId: input.rulesId,
        organizationId: input.organizationId,
        scoreEnabled: input.scoreEnabled ?? true,
        minScore: input.minScore ?? null,
        maxScore: input.maxScore ?? null,
        allowDraw: input.allowDraw ?? true,
        validationMode: input.validationMode,
        validationTimerHours: input.validationTimerHours,
        createdBy,
      },
      {
        baseMmr: input.baseMmr ?? 1000,
        kFactor: input.kFactor ?? 32,
        placementMatches: input.placementMatches ?? 5,
        usePreviousMmr: input.usePreviousMmr ?? false,
        allowAsymmetricMatches: input.allowAsymmetricMatches ?? false,
        sourceTierSeasonId: input.sourceTierSeasonId ?? null,
      },
    );

    if (input.usePreviousMmr) {
      await this.importPreviousMmr(
        result.tournament.id,
        input.disciplineId,
        input.baseMmr ?? 1000,
      );
    }

    return result;
  }

  async startSeason(id: string, userId: string) {
    await this.assertCanManage(userId);
    const season = await this.getSeasonOrThrow(id);

    if (season.status !== "draft") {
      throw new BadRequestError(ErrorCode.TOURNAMENT_INVALID_STATUS);
    }

    const config = await rankedSeasonRepository.getConfigByTournamentId(id);
    const baseMmr = config?.baseMmr ?? 1000;

    await tournamentRepository.update(id, { status: "ongoing" });
    if (config?.sourceTierSeasonId) {
      await rankedSeasonRepository.copyTiersFromSeason(
        config.sourceTierSeasonId,
        id,
        baseMmr,
      );
    } else {
      await rankedSeasonRepository.initDefaultTiers(id, baseMmr);
    }

    return await rankedSeasonRepository.getSeasonWithConfig(id);
  }

  async endSeason(id: string, userId: string) {
    await this.assertCanManage(userId);
    const season = await this.getSeasonOrThrow(id);

    if (season.status !== "ongoing") {
      throw new BadRequestError(ErrorCode.TOURNAMENT_INVALID_STATUS);
    }

    await tournamentRepository.update(id, { status: "finished" });
    return await rankedSeasonRepository.getSeasonWithConfig(id);
  }

  async updateSeason(
    id: string,
    input: UpdateRankedSeasonInput,
    userId: string,
  ) {
    await this.assertCanManage(userId);
    const season = await this.getSeasonOrThrow(id);

    if (season.status !== "draft") {
      throw new BadRequestError(ErrorCode.TOURNAMENT_FIELD_UPDATE_FORBIDDEN);
    }

    await this.applyTournamentUpdate(id, input);
    await this.applyConfigUpdate(id, input);

    return await rankedSeasonRepository.getSeasonWithConfig(id);
  }

  private async applyTournamentUpdate(
    id: string,
    input: UpdateRankedSeasonInput,
  ): Promise<void> {
    const hasTournamentUpdate =
      input.name ||
      input.description ||
      input.startDate ||
      input.endDate ||
      input.rulesId !== undefined ||
      input.scoreEnabled !== undefined ||
      input.minScore !== undefined ||
      input.maxScore !== undefined ||
      input.allowDraw !== undefined ||
      input.validationMode !== undefined ||
      input.validationTimerHours !== undefined;

    if (!hasTournamentUpdate) return;

    await tournamentRepository.update(id, {
      name: input.name,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      rulesId: input.rulesId,
      ...(input.scoreEnabled !== undefined && { scoreEnabled: input.scoreEnabled }),
      ...(input.minScore !== undefined && { minScore: input.minScore }),
      ...(input.maxScore !== undefined && { maxScore: input.maxScore }),
      ...(input.allowDraw !== undefined && { allowDraw: input.allowDraw }),
      ...(input.validationMode !== undefined && { validationMode: input.validationMode }),
      ...(input.validationTimerHours !== undefined && {
        validationTimerHours: input.validationTimerHours,
      }),
    });
  }

  private async applyConfigUpdate(
    id: string,
    input: UpdateRankedSeasonInput,
  ): Promise<void> {
    const configUpdate: Record<string, unknown> = {};
    if (input.baseMmr !== undefined) configUpdate.baseMmr = input.baseMmr;
    if (input.kFactor !== undefined) configUpdate.kFactor = input.kFactor;
    if (input.placementMatches !== undefined)
      configUpdate.placementMatches = input.placementMatches;
    if (input.usePreviousMmr !== undefined)
      configUpdate.usePreviousMmr = input.usePreviousMmr;
    if (input.allowAsymmetricMatches !== undefined)
      configUpdate.allowAsymmetricMatches = input.allowAsymmetricMatches;
    if (input.sourceTierSeasonId !== undefined)
      configUpdate.sourceTierSeasonId = input.sourceTierSeasonId;

    if (Object.keys(configUpdate).length > 0) {
      await rankedSeasonRepository.updateConfig(id, configUpdate);
    }
  }

  async getSeasonDetails(id: string) {
    return this.getSeasonOrThrow(id);
  }

  async listSeasons(filters?: { disciplineId?: string; status?: TournamentStatus }) {
    return await rankedSeasonRepository.listSeasons(filters);
  }

  /**
   * Recalculate tier min_mmr based on percentiles of MMR distribution.
   * legend = top 10%, master = top 30%, strategist = top 60%, challenger = rest
   */
  async recalculateTierMinMmr(seasonId: string, baseMmr: number) {
    const tiers = await rankedSeasonRepository.getRankTiers(seasonId);
    if (tiers.length === 0) return;

    const allPlayers =
      await playerMmrRepository.getAllPlayersBySeasonId(seasonId);
    const sorted = allPlayers.map((p) => p.currentMmr).sort((a, b) => a - b);
    const n = sorted.length;

    for (const tier of tiers) {
      const minMmr =
        tier.percentile === 0 || n === 0
          ? baseMmr
          : (sorted[Math.floor(n * tier.percentile)] ?? baseMmr);
      await rankedSeasonRepository.upsertRankTier(seasonId, tier.level, {
        minMmr,
      });
    }
  }

  /**
   * Import MMR from previous season with soft reset: newMmr = baseMmr + (oldMmr - baseMmr) * 0.5
   */
  private async importPreviousMmr(
    newSeasonId: string,
    disciplineId: string,
    baseMmr: number,
  ) {
    const lastSeason =
      await rankedSeasonRepository.getLastFinishedSeason(disciplineId);
    if (!lastSeason) return;

    const prevPlayers = await playerMmrRepository.getAllPlayersBySeasonId(
      lastSeason.id,
    );

    for (const prev of prevPlayers) {
      const newMmr = Math.round(baseMmr + (prev.currentMmr - baseMmr) * 0.5);
      await playerMmrRepository.upsert({
        seasonId: newSeasonId,
        playerId: prev.playerId,
        currentMmr: newMmr,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winStreak: 0,
        maxWinStreak: 0,
      });
    }
  }

  async computeAndCacheOfficial(seasonId: string): Promise<void> {
    const [players, tiers] = await Promise.all([
      playerMmrRepository.getBySeasonOrdered(seasonId),
      rankedSeasonRepository.getRankTiers(seasonId),
    ]);
    await rankedCacheRepository.upsertOfficial(seasonId, { players: players as ClientPlayerMmr[], tiers });
  }

  async computeAndCacheProvisional(seasonId: string): Promise<void> {
    const config = await rankedSeasonRepository.getConfigByTournamentId(seasonId);
    if (!config) return;

    const [players, tiers] = await Promise.all([
      playerMmrRepository.getBySeasonOrdered(seasonId),
      rankedSeasonRepository.getRankTiers(seasonId),
    ]);

    const ctx: ProvisionalReplayCtx = {
      baseMmr: config.baseMmr,
      kFactor: config.kFactor,
      provisionalMmr: new Map(players.map((p) => [p.playerId, p.currentMmr])),
      provisionalResults: new Map(
        players.map((p) => [p.playerId, (p as ClientPlayerMmr).recentResults ?? []]),
      ),
    };

    const unfinalizedMatches = await loadUnfinalizedMatches(seasonId);
    for (const match of unfinalizedMatches) {
      this.replayMatch(match, ctx);
    }

    const provisionalOnlyPlayers = await this.collectProvisionalOnlyPlayers(
      unfinalizedMatches,
      players,
      seasonId,
      ctx,
    );
    const provisionalPlayers = this.buildProvisionalPlayers(
      players,
      provisionalOnlyPlayers,
      ctx,
    );

    await rankedCacheRepository.upsertProvisional(seasonId, {
      players: provisionalPlayers,
      tiers,
    });
  }

  private replayMatch(match: UnfinalizedMatch, ctx: ProvisionalReplayCtx): void {
    const sideA = match.sides[0];
    const sideB = match.sides[1];
    if (!sideA || !sideB) return;

    const idsA = sideA.entry?.players.map((p) => p.playerId) ?? [];
    const idsB = sideB.entry?.players.map((p) => p.playerId) ?? [];
    if (!idsA.length || !idsB.length) return;

    const scoreA = sideA.score ?? 0;
    const scoreB = sideB.score ?? 0;
    const scoreCountsForMmr = match.outcomeType?.scoreCountsForMmr ?? true;
    const outcomePoints = match.outcomeType?.points ?? null;

    this.applyProvisionalResults({
      playerIds: idsA,
      myScore: scoreA,
      oppScore: scoreB,
      oppAvgMmr: this.averageMmr(idsB, ctx),
      result: sideResult(match.winnerSide, "A"),
      scoreCountsForMmr,
      outcomePoints,
      ctx,
    });
    this.applyProvisionalResults({
      playerIds: idsB,
      myScore: scoreB,
      oppScore: scoreA,
      oppAvgMmr: this.averageMmr(idsA, ctx),
      result: sideResult(match.winnerSide, "B"),
      scoreCountsForMmr,
      outcomePoints,
      ctx,
    });
  }

  private averageMmr(ids: string[], ctx: ProvisionalReplayCtx): number {
    const total = ids.reduce((s, id) => s + (ctx.provisionalMmr.get(id) ?? ctx.baseMmr), 0);
    return total / ids.length;
  }

  private applyProvisionalResults(args: {
    playerIds: string[];
    myScore: number;
    oppScore: number;
    oppAvgMmr: number;
    result: MatchResult;
    scoreCountsForMmr: boolean;
    outcomePoints: number | null;
    ctx: ProvisionalReplayCtx;
  }): void {
    const { playerIds, myScore, oppScore, oppAvgMmr, result, scoreCountsForMmr, outcomePoints, ctx } = args;
    const outcome = resultToOutcome(result);
    const kEff = mmrCalculationService.calculateEffectiveK(
      ctx.kFactor,
      myScore,
      oppScore,
      false,
      scoreCountsForMmr,
      outcomePoints,
    );

    for (const playerId of playerIds) {
      const mmr = ctx.provisionalMmr.get(playerId) ?? ctx.baseMmr;
      const delta = mmrCalculationService.calculateMmrDelta(mmr, oppAvgMmr, result, kEff);
      ctx.provisionalMmr.set(playerId, Math.max(1, mmr + delta));
      const prev = ctx.provisionalResults.get(playerId) ?? [];
      ctx.provisionalResults.set(playerId, [{ outcome }, ...prev].slice(0, 5));
    }
  }

  private findProvisionalOnlyPlayerIds(
    unfinalizedMatches: UnfinalizedMatch[],
    players: SeasonPlayers,
  ): string[] {
    const allUnfinalizedPlayerIds = new Set<string>();
    for (const match of unfinalizedMatches) {
      for (const p of match.sides[0]?.entry?.players ?? []) allUnfinalizedPlayerIds.add(p.playerId);
      for (const p of match.sides[1]?.entry?.players ?? []) allUnfinalizedPlayerIds.add(p.playerId);
    }
    const officialPlayerIds = new Set(players.map((p) => p.playerId));
    return [...allUnfinalizedPlayerIds].filter((id) => !officialPlayerIds.has(id));
  }

  // Players who only appear in unfinalized matches have no player_mmr row yet
  private async collectProvisionalOnlyPlayers(
    unfinalizedMatches: UnfinalizedMatch[],
    players: SeasonPlayers,
    seasonId: string,
    ctx: ProvisionalReplayCtx,
  ): Promise<ClientPlayerMmr[]> {
    const newPlayerIds = this.findProvisionalOnlyPlayerIds(unfinalizedMatches, players);
    if (newPlayerIds.length === 0) return [];

    const users = await db.query.appUsers.findMany({
      where: inArray(appUsers.id, newPlayerIds),
      columns: { id: true, displayName: true, shortName: true },
    });

    return users.map((user) => ({
      id: `provisional-${user.id}`,
      seasonId,
      playerId: user.id,
      currentMmr: ctx.provisionalMmr.get(user.id) ?? ctx.baseMmr,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      winStreak: 0,
      maxWinStreak: 0,
      player: { id: user.id, displayName: user.displayName, shortName: user.shortName },
      recentResults: ctx.provisionalResults.get(user.id) ?? [],
    }));
  }

  private buildProvisionalPlayers(
    players: SeasonPlayers,
    provisionalOnlyPlayers: ClientPlayerMmr[],
    ctx: ProvisionalReplayCtx,
  ): ClientPlayerMmr[] {
    return [
      ...players.map((p) => {
        const provisionalResults = ctx.provisionalResults.get(p.playerId)
        const recentResults = provisionalResults ?? []
        const winStreak = provisionalResults !== undefined
          ? countLeadingWins(provisionalResults)
          : (p as ClientPlayerMmr).winStreak
        return {
          ...(p as ClientPlayerMmr),
          currentMmr: ctx.provisionalMmr.get(p.playerId) ?? p.currentMmr,
          recentResults,
          winStreak,
        }
      }),
      ...provisionalOnlyPlayers,
    ].sort((a, b) => b.currentMmr - a.currentMmr);
  }

  private async getSeasonOrThrow(id: string) {
    const season = await rankedSeasonRepository.getSeasonWithConfig(id);
    if (!season) {
      throw new NotFoundError(ErrorCode.SEASON_NOT_FOUND);
    }
    return season;
  }

  private async assertCanManage(userId: string) {
    const user = await userRepository.getById(userId);
    if (!user) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN);
    }
    if (user.role !== "super_admin" && user.role !== "tournament_admin") {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }
  }
}

export const rankedSeasonService = new RankedSeasonService();
