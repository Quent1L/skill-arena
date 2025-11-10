import { eq, and, count } from "drizzle-orm";
import { db } from "../config/database";
import { tournaments, tournamentAdmins, appUsers } from "../db/schema";
import {
  type TournamentMode,
  type TeamMode,
  type TournamentStatus,
} from "@skill-arena/shared";

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
  startDate: string;
  endDate: string;
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
}

export interface TournamentFilters {
  status?: TournamentStatus;
  mode?: TournamentMode;
  createdBy?: string;
}

export class TournamentRepository {
  /**
   * Create a new tournament
   */
  async create(data: CreateTournamentData) {
    const [tournament] = await db.insert(tournaments).values(data).returning();

    return tournament;
  }

  /**
   * Get tournament by ID
   */
  async getById(id: string) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, id),
      with: {
        creator: true,
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

    const result = await db.query.tournaments.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        creator: true,
      },
      orderBy: (tournaments, { desc }) => [desc(tournaments.createdAt)],
    });

    return result;
  }

  /**
   * Update tournament
   */
  async update(id: string, data: UpdateTournamentData) {
    const [updated] = await db
      .update(tournaments)
      .set(data)
      .where(eq(tournaments.id, id))
      .returning();

    return updated;
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
        and(eq(tournaments.createdBy, userId), eq(tournaments.status, status))
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
        eq(tournamentAdmins.userId, userId)
      ),
    });

    return !!adminRecord;
  }

  /**
   * Add tournament admin
   */
  async addAdmin(
    tournamentId: string,
    userId: string,
    role: "owner" | "co_admin"
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
