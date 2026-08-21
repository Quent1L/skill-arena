import { eq, and, inArray, asc, sql, count } from "drizzle-orm";
import type {
  CreateRankTierInput,
  UpdateRankTierInput,
  TierScalingMode,
} from "@skol-arena/shared/types/index";
import { db } from "../config/database";
import {
  tournaments,
  tournamentAdmins,
  rankedSeasonConfigs,
  rankTiers,
  mmrAnimationEvents,
  playerMmr,
} from "../db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type * as schema from "../db/schema";
import type { TournamentStatus } from "@skol-arena/shared/types/index";

type DbTransaction = NodePgDatabase<typeof schema> | typeof db;

/** Old level -> new level, for the tiers that actually moved. */
type LevelMapping = Map<number, number>;

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
  softResetFactor: number;
  allowAsymmetricMatches: boolean;
  sourceTierSeasonId?: string | null;
  tierScalingMode?: TierScalingMode;
  sourceMmrSeasonId?: string | null;
}

export interface InsertRankTierData {
  level: number;
  name: string;
  percentile: number;
  minMmr: number;
  subRanks?: number;
  iconClass?: string | null;
}

export interface UpdateRankedConfigData {
  baseMmr?: number;
  kFactor?: number;
  placementMatches?: number;
  usePreviousMmr?: boolean;
  softResetFactor?: number;
  allowAsymmetricMatches?: boolean;
  sourceTierSeasonId?: string | null;
  tierScalingMode?: TierScalingMode;
  sourceMmrSeasonId?: string | null;
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

  async getRankTiers(seasonId: string, tx: DbTransaction = db) {
    return await tx.query.rankTiers.findMany({
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

  /**
   * Inserts a ready-made ladder. The caller owns the MMR thresholds — copying a
   * ladder from another season means rescaling them onto the new season's MMR
   * scale, which is business logic, not a repository concern.
   */
  async insertTiers(seasonId: string, rows: InsertRankTierData[]) {
    for (const tier of rows) {
      await db
        .insert(rankTiers)
        .values({
          seasonId,
          level: tier.level,
          name: tier.name,
          percentile: tier.percentile,
          subRanks: tier.subRanks ?? 1,
          minMmr: tier.minMmr,
          iconClass: tier.iconClass ?? null,
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
      with: { discipline: { columns: { id: true, name: true, icon: true } } },
      orderBy: (t, { desc }) => [desc(t.endDate)],
    });
  }

  /**
   * Season rows by id, with their discipline. Batch counterpart of the per-season
   * lookups above: a career read resolves every season a player has ever played in,
   * and doing that one round trip at a time scales with the player's history.
   */
  async getSeasonsByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return await db.query.tournaments.findMany({
      where: and(eq(tournaments.mode, "ranked"), inArray(tournaments.id, ids)),
      columns: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        disciplineId: true,
      },
      with: { discipline: { columns: { id: true, name: true, icon: true } } },
      orderBy: (t, { desc }) => [desc(t.endDate)],
    });
  }

  /** Batch counterpart of `getRankTiers`, ordered so each season's ladder stays 1..N. */
  async getRankTiersForSeasons(seasonIds: string[]) {
    if (seasonIds.length === 0) return [];
    return await db.query.rankTiers.findMany({
      where: inArray(rankTiers.seasonId, seasonIds),
      orderBy: (t, { asc }) => [asc(t.seasonId), asc(t.level)],
    });
  }

  /** Batch counterpart of `getConfigByTournamentId`. */
  async getConfigsByTournamentIds(tournamentIds: string[]) {
    if (tournamentIds.length === 0) return [];
    return await db.query.rankedSeasonConfigs.findMany({
      where: inArray(rankedSeasonConfigs.tournamentId, tournamentIds),
    });
  }

  /**
   * Move the given tiers to their new level in two passes, through negative
   * values: UNIQUE(season_id, level) is checked row by row, so a single pass
   * would collide with a tier that has not moved yet.
   */
  private async applyLevelMoves(
    tx: DbTransaction,
    moves: { id: string; level: number; newLevel: number }[],
  ): Promise<LevelMapping> {
    if (moves.length === 0) return new Map();
    const ids = moves.map((move) => move.id);

    await tx
      .update(rankTiers)
      .set({ level: sql`-${rankTiers.level}` })
      .where(inArray(rankTiers.id, ids));

    for (const move of moves) {
      await tx
        .update(rankTiers)
        .set({ level: move.newLevel })
        .where(eq(rankTiers.id, move.id));
    }

    return new Map(moves.map((move) => [move.level, move.newLevel]));
  }

  /** Close the gaps left by a deletion: levels become 1..N again. */
  private async resequenceLevels(
    tx: DbTransaction,
    seasonId: string,
  ): Promise<LevelMapping> {
    const remaining = await tx
      .select({ id: rankTiers.id, level: rankTiers.level })
      .from(rankTiers)
      .where(eq(rankTiers.seasonId, seasonId))
      .orderBy(asc(rankTiers.level));

    const moves = remaining
      .map((tier, index) => ({ ...tier, newLevel: index + 1 }))
      .filter((tier) => tier.newLevel !== tier.level);
    return await this.applyLevelMoves(tx, moves);
  }

  /** Free up `fromLevel` by pushing it and everything above it one level up. */
  private async shiftLevelsUp(
    tx: DbTransaction,
    seasonId: string,
    fromLevel: number,
  ): Promise<LevelMapping> {
    const affected = await tx
      .select({ id: rankTiers.id, level: rankTiers.level })
      .from(rankTiers)
      .where(
        and(eq(rankTiers.seasonId, seasonId), sql`${rankTiers.level} >= ${fromLevel}`),
      )
      .orderBy(asc(rankTiers.level));

    const moves = affected.map((tier) => ({ ...tier, newLevel: tier.level + 1 }));
    return await this.applyLevelMoves(tx, moves);
  }

  /**
   * Keep the tier levels frozen in mmr_animation_events consistent with the
   * renumbering. Levels pointing at a tier that no longer exists are nulled —
   * the stored tier name is kept, so past reveals still read correctly.
   */
  private async remapAnimationEventLevels(
    tx: DbTransaction,
    seasonId: string,
    mapping: LevelMapping,
    removedLevel: number | null,
  ) {
    if (mapping.size === 0 && removedLevel === null) return;

    const remap = (column: AnyPgColumn) => {
      const branches = [sql`CASE`];
      if (removedLevel !== null) {
        branches.push(sql` WHEN ${column} = ${removedLevel} THEN NULL`);
      }
      for (const [oldLevel, newLevel] of mapping) {
        branches.push(sql` WHEN ${column} = ${oldLevel} THEN ${newLevel}`);
      }
      branches.push(sql` ELSE ${column} END`);
      return sql.join(branches);
    };

    await tx
      .update(mmrAnimationEvents)
      .set({
        tierBeforeLevel: remap(mmrAnimationEvents.tierBeforeLevel),
        tierAfterLevel: remap(mmrAnimationEvents.tierAfterLevel),
      })
      .where(eq(mmrAnimationEvents.seasonId, seasonId));
  }

  /**
   * Insert a tier and return the whole season back at contiguous levels 1..N.
   * The requested level is clamped to the end of the ladder; inserting in the
   * middle pushes the tiers above it one level up.
   */
  async insertTier(seasonId: string, data: CreateRankTierInput) {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({ level: rankTiers.level })
        .from(rankTiers)
        .where(eq(rankTiers.seasonId, seasonId));
      const maxLevel = existing.reduce((max, tier) => Math.max(max, tier.level), 0);
      const level = Math.min(Math.max(data.level, 1), maxLevel + 1);

      if (level <= maxLevel) {
        const mapping = await this.shiftLevelsUp(tx, seasonId, level);
        await this.remapAnimationEventLevels(tx, seasonId, mapping, null);
      }

      await tx.insert(rankTiers).values({ seasonId, ...data, level });
      return await this.getRankTiers(seasonId, tx);
    });
  }

  async updateTier(seasonId: string, level: number, data: UpdateRankTierInput) {
    const [updated] = await db
      .update(rankTiers)
      .set(data)
      .where(and(eq(rankTiers.seasonId, seasonId), eq(rankTiers.level, level)))
      .returning();
    return updated;
  }

  /**
   * Delete a tier and close the gap it leaves, so levels stay 1..N. Levels are
   * the business key of a tier (unique per season, used in URLs and frozen in
   * mmr_animation_events), so the renumbering is transactional.
   */
  async deleteTier(seasonId: string, level: number) {
    return await db.transaction(async (tx) => {
      await tx
        .delete(rankTiers)
        .where(and(eq(rankTiers.seasonId, seasonId), eq(rankTiers.level, level)));

      const mapping = await this.resequenceLevels(tx, seasonId);
      await this.remapAnimationEventLevels(tx, seasonId, mapping, level);

      return await this.getRankTiers(seasonId, tx);
    });
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
    /** Requesting user, used to resolve `isParticipant`. Omit for anonymous callers. */
    viewerId?: string;
  }) {
    const conditions = [eq(tournaments.mode, "ranked")];
    if (filters?.disciplineId) {
      conditions.push(eq(tournaments.disciplineId, filters.disciplineId));
    }
    if (filters?.status) {
      conditions.push(eq(tournaments.status, filters.status));
    }
    const seasons = await db.query.tournaments.findMany({
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
        discipline: { columns: { id: true, name: true, icon: true } },
      },
      orderBy: (t, { desc }) => [desc(t.startDate)],
    });

    return await this.withSeasonParticipation(seasons, filters?.viewerId);
  }

  /**
   * Attach `participantCount` / `isParticipant` to a batch of season rows.
   *
   * A ranked season has no registration table: taking part means owning a
   * `player_mmr` row, which `mmrCalculationService` creates on the first
   * finalized match.
   */
  private async withSeasonParticipation<T extends { id: string }>(
    rows: T[],
    viewerId?: string,
  ): Promise<(T & { participantCount: number; isParticipant: boolean })[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);

    const counts = await db
      .select({ seasonId: playerMmr.seasonId, total: count() })
      .from(playerMmr)
      .where(inArray(playerMmr.seasonId, ids))
      .groupBy(playerMmr.seasonId);

    const countBySeason = new Map(
      counts.map((row) => [row.seasonId, Number(row.total)]),
    );

    const joined = viewerId
      ? await db
          .select({ seasonId: playerMmr.seasonId })
          .from(playerMmr)
          .where(
            and(
              inArray(playerMmr.seasonId, ids),
              eq(playerMmr.playerId, viewerId),
            ),
          )
      : [];

    const joinedIds = new Set(joined.map((row) => row.seasonId));

    return rows.map((row) => ({
      ...row,
      participantCount: countBySeason.get(row.id) ?? 0,
      isParticipant: joinedIds.has(row.id),
    }));
  }
}

export const rankedSeasonRepository = new RankedSeasonRepository();
