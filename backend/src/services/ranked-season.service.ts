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

    if (
      input.name ||
      input.description ||
      input.startDate ||
      input.endDate ||
      input.rulesId !== undefined ||
      input.scoreEnabled !== undefined ||
      input.minScore !== undefined ||
      input.maxScore !== undefined ||
      input.allowDraw !== undefined
    ) {
      await tournamentRepository.update(id, {
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        rulesId: input.rulesId,
        ...(input.scoreEnabled !== undefined && {
          scoreEnabled: input.scoreEnabled,
        }),
        ...(input.minScore !== undefined && { minScore: input.minScore }),
        ...(input.maxScore !== undefined && { maxScore: input.maxScore }),
        ...(input.allowDraw !== undefined && { allowDraw: input.allowDraw }),
      });
    }

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

    return await rankedSeasonRepository.getSeasonWithConfig(id);
  }

  async getSeasonDetails(id: string) {
    const season = await rankedSeasonRepository.getSeasonWithConfig(id);
    if (!season) {
      throw new NotFoundError(ErrorCode.SEASON_NOT_FOUND);
    }
    return season;
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

    const baseMmr = config.baseMmr;
    const kFactor = config.kFactor;

    const provisionalMmr = new Map<string, number>(players.map((p) => [p.playerId, p.currentMmr]));
    const provisionalResults = new Map<string, { outcome: 'win' | 'loss' | 'draw' }[]>(
      players.map((p) => [p.playerId, (p as ClientPlayerMmr).recentResults ?? []])
    );

    const unfinalizedMatches = await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, seasonId),
        inArray(matches.status, ['reported', 'pending_confirmation', 'disputed']),
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

    for (const match of unfinalizedMatches) {
      const sideA = match.sides[0];
      const sideB = match.sides[1];
      if (!sideA || !sideB) continue;

      const idsA = sideA.entry?.players.map((p) => p.playerId) ?? [];
      const idsB = sideB.entry?.players.map((p) => p.playerId) ?? [];
      if (!idsA.length || !idsB.length) continue;

      const avgMmrA = idsA.reduce((s, id) => s + (provisionalMmr.get(id) ?? baseMmr), 0) / idsA.length;
      const avgMmrB = idsB.reduce((s, id) => s + (provisionalMmr.get(id) ?? baseMmr), 0) / idsB.length;
      const scoreCountsForMmr = match.outcomeType?.scoreCountsForMmr ?? true;
      const outcomePoints = match.outcomeType?.points ?? null;
      const scoreA = sideA.score ?? 0;
      const scoreB = sideB.score ?? 0;

      for (const playerId of idsA) {
        const mmr = provisionalMmr.get(playerId) ?? baseMmr;
        const result: 1 | 0 | 0.5 = match.winnerSide === 'A' ? 1 : match.winnerSide === 'B' ? 0 : 0.5;
        const kEff = mmrCalculationService.calculateEffectiveK(kFactor, scoreA, scoreB, false, scoreCountsForMmr, outcomePoints);
        const delta = mmrCalculationService.calculateMmrDelta(mmr, avgMmrB, result, kEff);
        provisionalMmr.set(playerId, Math.max(1, mmr + delta));
        const outcome: 'win' | 'loss' | 'draw' = result === 1 ? 'win' : result === 0 ? 'loss' : 'draw';
        const prev = provisionalResults.get(playerId) ?? [];
        provisionalResults.set(playerId, [{ outcome }, ...prev].slice(0, 5));
      }

      for (const playerId of idsB) {
        const mmr = provisionalMmr.get(playerId) ?? baseMmr;
        const result: 1 | 0 | 0.5 = match.winnerSide === 'B' ? 1 : match.winnerSide === 'A' ? 0 : 0.5;
        const kEff = mmrCalculationService.calculateEffectiveK(kFactor, scoreB, scoreA, false, scoreCountsForMmr, outcomePoints);
        const delta = mmrCalculationService.calculateMmrDelta(mmr, avgMmrA, result, kEff);
        provisionalMmr.set(playerId, Math.max(1, mmr + delta));
        const outcome: 'win' | 'loss' | 'draw' = result === 1 ? 'win' : result === 0 ? 'loss' : 'draw';
        const prev = provisionalResults.get(playerId) ?? [];
        provisionalResults.set(playerId, [{ outcome }, ...prev].slice(0, 5));
      }
    }

    // Include players who only appear in unfinalized matches (no player_mmr entry yet)
    const allUnfinalizedPlayerIds = new Set<string>();
    for (const match of unfinalizedMatches) {
      match.sides[0]?.entry?.players.forEach(p => allUnfinalizedPlayerIds.add(p.playerId));
      match.sides[1]?.entry?.players.forEach(p => allUnfinalizedPlayerIds.add(p.playerId));
    }
    const officialPlayerIds = new Set(players.map(p => p.playerId));
    const newPlayerIds = [...allUnfinalizedPlayerIds].filter(id => !officialPlayerIds.has(id));

    let provisionalOnlyPlayers: ClientPlayerMmr[] = [];
    if (newPlayerIds.length > 0) {
      const users = await db.query.appUsers.findMany({
        where: inArray(appUsers.id, newPlayerIds),
        columns: { id: true, displayName: true, shortName: true },
      });
      provisionalOnlyPlayers = users.map(user => ({
        id: `provisional-${user.id}`,
        seasonId,
        playerId: user.id,
        currentMmr: provisionalMmr.get(user.id) ?? baseMmr,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winStreak: 0,
        maxWinStreak: 0,
        player: { id: user.id, displayName: user.displayName, shortName: user.shortName },
        recentResults: provisionalResults.get(user.id) ?? [],
      }));
    }

    const provisionalPlayers: ClientPlayerMmr[] = [
      ...players.map((p) => ({
        ...(p as ClientPlayerMmr),
        currentMmr: provisionalMmr.get(p.playerId) ?? p.currentMmr,
        recentResults: provisionalResults.get(p.playerId) ?? [],
      })),
      ...provisionalOnlyPlayers,
    ].sort((a, b) => b.currentMmr - a.currentMmr);

    await rankedCacheRepository.upsertProvisional(seasonId, { players: provisionalPlayers, tiers });
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
