import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { tournamentRepository } from "../repository/tournament.repository";
import { userRepository } from "../repository/user.repository";
import type { CreateRankedSeasonInput, UpdateRankedSeasonInput } from "@skill-arena/shared/types/index";
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
        createdBy,
      },
      {
        baseMmr: input.baseMmr ?? 1000,
        kFactor: input.kFactor ?? 32,
        placementMatches: input.placementMatches ?? 5,
        usePreviousMmr: input.usePreviousMmr ?? false,
        allowAsymmetricMatches: input.allowAsymmetricMatches ?? false,
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

    await tournamentRepository.update(id, { status: "ongoing" });
    await this.calculateRankBoundaries(id);

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

  async updateSeason(id: string, input: UpdateRankedSeasonInput, userId: string) {
    await this.assertCanManage(userId);
    const season = await this.getSeasonOrThrow(id);

    if (season.status !== "draft") {
      throw new BadRequestError(ErrorCode.TOURNAMENT_FIELD_UPDATE_FORBIDDEN);
    }

    if (input.name || input.description || input.startDate || input.endDate || input.rulesId !== undefined) {
      await tournamentRepository.update(id, {
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        rulesId: input.rulesId,
      });
    }

    const configUpdate: Record<string, unknown> = {};
    if (input.baseMmr !== undefined) configUpdate.baseMmr = input.baseMmr;
    if (input.kFactor !== undefined) configUpdate.kFactor = input.kFactor;
    if (input.placementMatches !== undefined) configUpdate.placementMatches = input.placementMatches;
    if (input.usePreviousMmr !== undefined) configUpdate.usePreviousMmr = input.usePreviousMmr;
    if (input.allowAsymmetricMatches !== undefined) configUpdate.allowAsymmetricMatches = input.allowAsymmetricMatches;

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

  async listSeasons(filters?: { disciplineId?: string; status?: string }) {
    return await rankedSeasonRepository.listSeasons(filters as any);
  }

  /**
   * Calculate rank boundaries based on percentiles (40/70/90 of MMR distribution)
   * challenger = top 10%, master = top 30%, strategist = top 60%, rest = legend
   */
  private async calculateRankBoundaries(seasonId: string) {
    const config = await rankedSeasonRepository.getConfigByTournamentId(seasonId);
    const baseMmr = config?.baseMmr ?? 1000;

    const allPlayers = await playerMmrRepository.getAllPlayersBySeasonId(seasonId);

    if (allPlayers.length === 0) {
      // Default boundaries based on baseMmr
      await rankedSeasonRepository.setRankBoundaries(seasonId, {
        challengerMax: baseMmr + 400,
        strategistMax: baseMmr + 200,
        masterMax: baseMmr + 300,
      });
      return;
    }

    const sorted = allPlayers.map((p) => p.currentMmr).sort((a, b) => a - b);
    const n = sorted.length;

    const strategistMax = sorted[Math.floor(n * 0.4)] ?? baseMmr;
    const masterMax = sorted[Math.floor(n * 0.7)] ?? baseMmr + 200;
    const challengerMax = sorted[Math.floor(n * 0.9)] ?? baseMmr + 400;

    await rankedSeasonRepository.setRankBoundaries(seasonId, {
      challengerMax,
      strategistMax,
      masterMax,
    });
  }

  /**
   * Import MMR from previous season with soft reset: newMmr = baseMmr + (oldMmr - baseMmr) * 0.5
   */
  private async importPreviousMmr(
    newSeasonId: string,
    disciplineId: string,
    baseMmr: number,
  ) {
    const lastSeason = await rankedSeasonRepository.getLastFinishedSeason(disciplineId);
    if (!lastSeason) return;

    const prevPlayers = await playerMmrRepository.getAllPlayersBySeasonId(lastSeason.id);

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
