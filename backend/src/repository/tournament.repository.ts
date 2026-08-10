import { eq, and, count, ne, inArray } from "drizzle-orm";
import { db } from "../config/database";
import {
  tournaments,
  tournamentAdmins,
  appUsers,
  tournamentParticipants,
} from "../db/schema";
import {
  type TournamentMode,
  type TeamMode,
  type TournamentStatus,
  type ValidationMode,
} from "@skol-arena/shared/types/index";
import { handleDatabaseError } from "../utils/db-errors";

export interface CreateTournamentData {
  name: string;
  description?: string;
  mode: TournamentMode;
  teamMode: TeamMode;
  minTeamSize: number;
  maxTeamSize: number;
  maxMatchesPerPlayer: number;
  maxTimesWithSamePartner: number;
  maxTimesWithSameOpponent: number;
  pointPerVictory: number | null;
  pointPerDraw: number | null;
  pointPerLoss: number | null;
  allowDraw: boolean | null;
  scoreEnabled?: boolean;
  startDate: string;
  endDate: string;
  disciplineId?: string;
  minScore?: number | null;
  maxScore?: number | null;
  validationMode?: ValidationMode;
  validationTimerHours?: number | null;
  createdBy: string;
  status: TournamentStatus;
}

export interface UpdateTournamentData {
  name?: string;
  description?: string;
  mode?: TournamentMode;
  teamMode?: TeamMode;
  teamSize?: number;
  maxMatchesPerPlayer?: number;
  maxTimesWithSamePartner?: number;
  maxTimesWithSameOpponent?: number;
  pointPerVictory?: number;
  pointPerDraw?: number;
  pointPerLoss?: number;
  allowDraw?: boolean;
  startDate?: string;
  endDate?: string;
  status?: TournamentStatus;
  disciplineId?: string;
  scoreEnabled?: boolean;
  rulesId?: string | null;
  minScore?: number | null;
  maxScore?: number | null;
  validationMode?: ValidationMode;
  validationTimerHours?: number | null;
}

export interface TournamentFilters {
  status?: TournamentStatus;
  mode?: TournamentMode;
  createdBy?: string;
  excludeDraft?: boolean;
  excludeRanked?: boolean;
  /** Requesting user, used to resolve `isParticipant`. Omit for anonymous callers. */
  viewerId?: string;
}

export class TournamentRepository {
  /**
   * Create a new tournament
   */
  async create(data: CreateTournamentData) {
    const values: typeof tournaments.$inferInsert = {
      name: data.name,
      mode: data.mode,
      teamMode: data.teamMode,
      minTeamSize: data.minTeamSize,
      maxTeamSize: data.maxTeamSize,
      maxMatchesPerPlayer: data.maxMatchesPerPlayer,
      maxTimesWithSamePartner: data.maxTimesWithSamePartner,
      maxTimesWithSameOpponent: data.maxTimesWithSameOpponent,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      createdBy: data.createdBy,
      ...(data.description !== undefined && { description: data.description }),
      ...(data.pointPerVictory !== null &&
        data.pointPerVictory !== undefined && {
          pointPerVictory: data.pointPerVictory,
        }),
      ...(data.pointPerDraw !== null &&
        data.pointPerDraw !== undefined && { pointPerDraw: data.pointPerDraw }),
      ...(data.pointPerLoss !== null &&
        data.pointPerLoss !== undefined && { pointPerLoss: data.pointPerLoss }),
      ...(data.allowDraw !== null &&
        data.allowDraw !== undefined && { allowDraw: data.allowDraw }),
      ...(data.scoreEnabled !== undefined && {
        scoreEnabled: data.scoreEnabled,
      }),
      ...(data.disciplineId !== undefined && {
        disciplineId: data.disciplineId,
      }),
      ...(data.minScore !== undefined && { minScore: data.minScore }),
      ...(data.maxScore !== undefined && { maxScore: data.maxScore }),
      ...(data.validationMode !== undefined && { validationMode: data.validationMode }),
      ...(data.validationTimerHours !== undefined && {
        validationTimerHours: data.validationTimerHours,
      }),
    };

    try {
      const [tournament] = await db
        .insert(tournaments)
        .values(values)
        .returning();

      return tournament;
    } catch (error) {
      handleDatabaseError(error, {
        operation: "creation",
        name: data.name,
      });
    }
  }

  /**
   * Get tournament by ID
   */
  async getById(id: string) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, id),
      with: {
        creator: true,
        discipline: true,
        rules: {
          columns: {
            id: true,
          },
        },
        admins: {
          with: {
            user: true,
          },
        },
      },
    });

    return tournament;
  }

  /**
   * Get tournament by ID (simple, without relations)
   */
  async getByIdSimple(id: string) {
    return await db.query.tournaments.findFirst({
      where: eq(tournaments.id, id),
    });
  }

  /**
   * List tournaments with optional filters
   */
  async list(filters?: TournamentFilters) {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(tournaments.status, filters.status));
    }
    if (filters?.mode) {
      conditions.push(eq(tournaments.mode, filters.mode));
    }
    if (filters?.createdBy) {
      conditions.push(eq(tournaments.createdBy, filters.createdBy));
    }
    if (filters?.excludeDraft) {
      conditions.push(ne(tournaments.status, "draft"));
    }
    if (filters?.excludeRanked) {
      conditions.push(ne(tournaments.mode, "ranked"));
    }

    const result = await db.query.tournaments.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      columns: {
        id: true,
        name: true,
        mode: true,
        teamMode: true,
        status: true,
        startDate: true,
        endDate: true,
        disciplineId: true,
        organizationId: true,
      },
      with: {
        discipline: { columns: { id: true, name: true, icon: true } },
      },
      orderBy: (tournaments, { desc }) => [desc(tournaments.createdAt)],
    });

    return await this.withParticipation(result, filters?.viewerId);
  }

  /**
   * Attach `participantCount` / `isParticipant` to a batch of tournament rows.
   *
   * Two grouped queries rather than correlated subqueries: the relational query
   * builder aliases its root table, so a subquery correlating on
   * `tournaments.id` is not guaranteed to bind to the right alias.
   */
  async withParticipation<T extends { id: string }>(
    rows: T[],
    viewerId?: string,
  ): Promise<(T & { participantCount: number; isParticipant: boolean })[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);

    const counts = await db
      .select({
        tournamentId: tournamentParticipants.tournamentId,
        total: count(),
      })
      .from(tournamentParticipants)
      .where(
        and(
          inArray(tournamentParticipants.tournamentId, ids),
          eq(tournamentParticipants.status, "active"),
        ),
      )
      .groupBy(tournamentParticipants.tournamentId);

    const countByTournament = new Map(
      counts.map((row) => [row.tournamentId, Number(row.total)]),
    );

    const joined = viewerId
      ? await db
          .select({ tournamentId: tournamentParticipants.tournamentId })
          .from(tournamentParticipants)
          .where(
            and(
              inArray(tournamentParticipants.tournamentId, ids),
              eq(tournamentParticipants.userId, viewerId),
              eq(tournamentParticipants.status, "active"),
            ),
          )
      : [];

    const joinedIds = new Set(joined.map((row) => row.tournamentId));

    return rows.map((row) => ({
      ...row,
      participantCount: countByTournament.get(row.id) ?? 0,
      isParticipant: joinedIds.has(row.id),
    }));
  }

  /**
   * Update tournament
   */
  async update(id: string, data: UpdateTournamentData) {
    try {
      const [updated] = await db
        .update(tournaments)
        .set(data)
        .where(eq(tournaments.id, id))
        .returning();

      return updated;
    } catch (error) {
      handleDatabaseError(error, {
        operation: "update",
        name: data.name,
      });
    }
  }

  /**
   * Delete tournament
   */
  async delete(id: string) {
    await db.delete(tournaments).where(eq(tournaments.id, id));
  }

  /**
   * Count tournaments by user and status
   */
  async countByUserAndStatus(userId: string, status: TournamentStatus) {
    const result = await db
      .select({ count: count() })
      .from(tournaments)
      .where(
        and(eq(tournaments.createdBy, userId), eq(tournaments.status, status)),
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Check if user is tournament admin
   */
  async isUserTournamentAdmin(tournamentId: string, userId: string) {
    const adminRecord = await db.query.tournamentAdmins.findFirst({
      where: and(
        eq(tournamentAdmins.tournamentId, tournamentId),
        eq(tournamentAdmins.userId, userId),
      ),
    });

    return !!adminRecord;
  }

  /**
   * List the users who administrate a tournament (owner and co-admins).
   */
  async getAdminUserIds(tournamentId: string): Promise<string[]> {
    const records = await db.query.tournamentAdmins.findMany({
      where: eq(tournamentAdmins.tournamentId, tournamentId),
      columns: { userId: true },
    });

    return records.map((record) => record.userId);
  }

  /**
   * Add tournament admin
   */
  async addAdmin(
    tournamentId: string,
    userId: string,
    role: "owner" | "co_admin",
  ) {
    await db.insert(tournamentAdmins).values({
      tournamentId,
      userId,
      role,
    });
  }

  /**
   * Get user by ID (for permission checks)
   */
  async getUser(userId: string) {
    return await db.query.appUsers.findFirst({
      where: eq(appUsers.id, userId),
    });
  }
}

export const tournamentRepository = new TournamentRepository();
