import { eq, and, inArray } from "drizzle-orm";
import type {
  CreateRankTierInput,
  UpdateRankTierInput,
} from "@skill-arena/shared/types/index";
import { db } from "../config/database";
import {
  tournaments,
  tournamentAdmins,
  rankedSeasonConfigs,
  rankTiers,
} from "../db/schema";
import type { TournamentStatus } from "@skill-arena/shared/types/index";

export interface CreateRankedSeasonData {
  name: string;
  description?: string;
  disciplineId: string;
  startDate: string;
  endDate: string;
  minTeamSize: number;
  maxTeamSize: number;
  rulesId?: string | null;
  scoreEnabled?: boolean;
  minScore?: number | null;
  maxScore?: number | null;
  organizationId?: string | null;
  allowDraw?: boolean;
  validationMode?: string;
  validationTimerHours?: number | null;
  createdBy: string;
}

export interface CreateRankedConfigData {
  baseMmr: number;
  kFactor: number;
  placementMatches: number;
  usePreviousMmr: boolean;
  allowAsymmetricMatches: boolean;
  sourceTierSeasonId?: string | null;
}

export interface UpdateRankedConfigData {
  baseMmr?: number;
  kFactor?: number;
  placementMatches?: number;
  usePreviousMmr?: boolean;
  allowAsymmetricMatches?: boolean;
  sourceTierSeasonId?: string | null;
}

export class RankedSeasonRepository {
  async create(
    tournamentData: CreateRankedSeasonData,
    configData: CreateRankedConfigData,
  ) {
    return await db.transaction(async (tx) => {
      const [tournament] = await tx
        .insert(tournaments)
        .values({
          name: tournamentData.name,
          description: tournamentData.description,
          mode: "ranked",
          teamMode: "flex",
          minTeamSize: tournamentData.minTeamSize,
          maxTeamSize: tournamentData.maxTeamSize,
          startDate: tournamentData.startDate,
          endDate: tournamentData.endDate,
          disciplineId: tournamentData.disciplineId,
          rulesId: tournamentData.rulesId,
          organizationId: tournamentData.organizationId,
          scoreEnabled: tournamentData.scoreEnabled ?? true,
          minScore: tournamentData.minScore ?? null,
          maxScore: tournamentData.maxScore ?? null,
          createdBy: tournamentData.createdBy,
          status: "draft",
          allowDraw: tournamentData.allowDraw ?? true,
          validationMode: (tournamentData.validationMode as "auto" | "strict" | "admin") ?? "strict",
          validationTimerHours: tournamentData.validationTimerHours ?? null,
        })
        .returning();

      await tx.insert(tournamentAdmins).values({
        tournamentId: tournament.id,
        userId: tournamentData.createdBy,
        role: "owner",
      });

      const [config] = await tx
        .insert(rankedSeasonConfigs)
        .values({
          tournamentId: tournament.id,
          ...configData,
        })
        .returning();

      return { tournament, config };
    });
  }

  async getConfigByTournamentId(tournamentId: string) {
    return await db.query.rankedSeasonConfigs.findFirst({
      where: eq(rankedSeasonConfigs.tournamentId, tournamentId),
    });
  }

  async getActiveSeasonByDiscipline(disciplineId: string) {
    return await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.mode, "ranked"),
        eq(tournaments.disciplineId, disciplineId),
        inArray(tournaments.status, ["open", "ongoing"] as TournamentStatus[]),
      ),
    });
  }

  async updateConfig(tournamentId: string, data: UpdateRankedConfigData) {
    const [updated] = await db
      .update(rankedSeasonConfigs)
      .set(data)
      .where(eq(rankedSeasonConfigs.tournamentId, tournamentId))
      .returning();
    return updated;
  }

  static readonly DEFAULT_TIER_CONFIGS = [
    { level: 1, name: "Rookie",     percentile: 0,    minMmr: 700  },
    { level: 2, name: "Challenger", percentile: 0.4,  minMmr: 900  },
    { level: 3, name: "Confirmé",   percentile: 0.7,  minMmr: 1100 },
    { level: 4, name: "Expert",     percentile: 0.9,  minMmr: 1300 },
    { level: 5, name: "Légende",    percentile: 0.95, minMmr: 1500 },
  ] as const;

  async getRankTiers(seasonId: string) {
    return await db.query.rankTiers.findMany({
      where: eq(rankTiers.seasonId, seasonId),
      orderBy: (t, { asc }) => [asc(t.level)],
    });
  }

  async upsertRankTier(
    seasonId: string,
    level: number,
    data: { minMmr: number },
  ) {
    const existing = await db.query.rankTiers.findFirst({
      where: and(eq(rankTiers.seasonId, seasonId), eq(rankTiers.level, level)),
    });
    if (existing) {
      const [updated] = await db
        .update(rankTiers)
        .set({ minMmr: data.minMmr, calculatedAt: new Date() })
        .where(
          and(eq(rankTiers.seasonId, seasonId), eq(rankTiers.level, level)),
        )
        .returning();
      return updated;
    }
    const config = RankedSeasonRepository.DEFAULT_TIER_CONFIGS.find(
      (t) => t.level === level,
    );
    const [created] = await db
      .insert(rankTiers)
      .values({
        seasonId,
        level,
        name: config?.name ?? `Tier ${level}`,
        percentile: config?.percentile ?? 0,
        minMmr: data.minMmr,
      })
      .returning();
    return created;
  }

  async initDefaultTiers(seasonId: string, _baseMmr: number) {
    for (const tier of RankedSeasonRepository.DEFAULT_TIER_CONFIGS) {
      await db
        .insert(rankTiers)
        .values({
          seasonId,
          level: tier.level,
          name: tier.name,
          percentile: tier.percentile,
          minMmr: tier.minMmr,
          subRanks: 1,
        })
        .onConflictDoNothing();
    }
  }

  async copyTiersFromSeason(
    sourceSeasonId: string,
    targetSeasonId: string,
    baseMmr: number,
  ) {
    const sourceTiers = await this.getRankTiers(sourceSeasonId);
    for (const tier of sourceTiers) {
      await db
        .insert(rankTiers)
        .values({
          seasonId: targetSeasonId,
          level: tier.level,
          name: tier.name,
          percentile: tier.percentile,
          subRanks: tier.subRanks,
          minMmr: baseMmr,
        })
        .onConflictDoNothing();
    }
  }

  async getFinishedSeasons() {
    return await db.query.tournaments.findMany({
      where: and(
        eq(tournaments.mode, "ranked"),
        eq(tournaments.status, "finished"),
      ),
      columns: { id: true, name: true, startDate: true, endDate: true },
      with: { discipline: { columns: { id: true, name: true } } },
      orderBy: (t, { desc }) => [desc(t.endDate)],
    });
  }

  async insertTier(seasonId: string, data: CreateRankTierInput) {
    const [created] = await db
      .insert(rankTiers)
      .values({ seasonId, ...data })
      .returning();
    return created;
  }

  async updateTier(seasonId: string, level: number, data: UpdateRankTierInput) {
    const [updated] = await db
      .update(rankTiers)
      .set(data)
      .where(and(eq(rankTiers.seasonId, seasonId), eq(rankTiers.level, level)))
      .returning();
    return updated;
  }

  async deleteTier(seasonId: string, level: number) {
    await db
      .delete(rankTiers)
      .where(and(eq(rankTiers.seasonId, seasonId), eq(rankTiers.level, level)));
  }

  async getLastFinishedSeason(disciplineId: string) {
    return await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.mode, "ranked"),
        eq(tournaments.disciplineId, disciplineId),
        eq(tournaments.status, "finished"),
      ),
      orderBy: (t, { desc }) => [desc(t.endDate)],
    });
  }

  async getSeasonWithConfig(id: string) {
    return await db.query.tournaments.findFirst({
      where: and(eq(tournaments.id, id), eq(tournaments.mode, "ranked")),
      with: {
        rankedConfig: true,
        rankTiers: true,
        discipline: true,
        rules: {
          columns: {
            id: true,
          },
        },
      },
    });
  }

  async listSeasons(filters?: {
    disciplineId?: string;
    status?: TournamentStatus;
  }) {
    const conditions = [eq(tournaments.mode, "ranked")];
    if (filters?.disciplineId) {
      conditions.push(eq(tournaments.disciplineId, filters.disciplineId));
    }
    if (filters?.status) {
      conditions.push(eq(tournaments.status, filters.status));
    }
    return await db.query.tournaments.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        name: true,
        mode: true,
        teamMode: true,
        status: true,
        startDate: true,
        endDate: true,
        disciplineId: true,
      },
      with: {
        discipline: { columns: { id: true, name: true } },
      },
      orderBy: (t, { desc }) => [desc(t.startDate)],
    });
  }
}

export const rankedSeasonRepository = new RankedSeasonRepository();
