import { eq, and, count } from "drizzle-orm";
import { db } from "../config/database";
import {
  tournaments,
  tournamentAdmins,
  appUsers,
  type tournamentModeEnum,
  type teamModeEnum,
  type tournamentStatusEnum,
} from "../db/schema";

export type TournamentMode = (typeof tournamentModeEnum.enumValues)[number];
export type TeamMode = (typeof teamModeEnum.enumValues)[number];
export type TournamentStatus = (typeof tournamentStatusEnum.enumValues)[number];

export interface CreateTournamentInput {
  name: string;
  description?: string;
  mode: TournamentMode;
  teamMode: TeamMode;
  teamSize: number;
  maxMatchesPerPlayer?: number;
  maxTimesWithSamePartner?: number;
  maxTimesWithSameOpponent?: number;
  pointPerVictory?: number;
  pointPerDraw?: number;
  pointPerLoss?: number;
  allowDraw?: boolean;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  createdBy: string; // uuid
}

export interface UpdateTournamentInput {
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

export class TournamentService {
  /**
   * Get or create app_user from BetterAuth external ID
   */
  async getOrCreateAppUser(
    betterAuthUserId: string,
    displayName: string
  ): Promise<string> {
    // Check if app_user already exists
    let appUser = await db.query.appUsers.findFirst({
      where: eq(appUsers.externalId, betterAuthUserId),
    });

    // If not, create it
    if (!appUser) {
      [appUser] = await db
        .insert(appUsers)
        .values({
          externalId: betterAuthUserId,
          displayName: displayName,
          role: "player",
        })
        .returning();
    }

    return appUser.id;
  }

  /**
   * Check if user can manage tournament (owner, co_admin, or super_admin)
   */
  async canManageTournament(
    tournamentId: string,
    userId: string
  ): Promise<boolean> {
    // Check if user is super_admin
    const user = await db.query.appUsers.findFirst({
      where: eq(appUsers.id, userId),
    });

    if (!user) return false;
    if (user.role === "super_admin") return true;

    // Check if user is tournament admin (owner or co_admin)
    const adminRecord = await db.query.tournamentAdmins.findFirst({
      where: and(
        eq(tournamentAdmins.tournamentId, tournamentId),
        eq(tournamentAdmins.userId, userId)
      ),
    });

    return !!adminRecord;
  }

  /**
   * Check if user can create tournaments
   */
  async canCreateTournament(userId: string): Promise<boolean> {
    const user = await db.query.appUsers.findFirst({
      where: eq(appUsers.id, userId),
    });

    if (!user) return false;
    return user.role === "tournament_admin" || user.role === "super_admin";
  }

  /**
   * Count draft tournaments for a user
   */
  async countDraftTournaments(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tournaments)
      .where(
        and(eq(tournaments.createdBy, userId), eq(tournaments.status, "draft"))
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Create a new tournament
   */
  async createTournament(input: CreateTournamentInput) {
    // Validate user permissions
    const canCreate = await this.canCreateTournament(input.createdBy);
    if (!canCreate) {
      throw new Error(
        "User does not have permission to create tournaments. Must be tournament_admin or super_admin."
      );
    }

    // Validate max 5 drafts rule
    const draftCount = await this.countDraftTournaments(input.createdBy);
    if (draftCount >= 5) {
      throw new Error("User cannot have more than 5 draft tournaments");
    }

    // Validate dates
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (startDate >= endDate) {
      throw new Error("Start date must be before end date");
    }

    // Validate team size
    if (input.teamSize < 1 || input.teamSize > 2) {
      throw new Error("Team size must be 1 or 2");
    }

    // Create tournament
    const [tournament] = await db
      .insert(tournaments)
      .values({
        name: input.name,
        description: input.description,
        mode: input.mode,
        teamMode: input.teamMode,
        teamSize: input.teamSize,
        maxMatchesPerPlayer: input.maxMatchesPerPlayer ?? 10,
        maxTimesWithSamePartner: input.maxTimesWithSamePartner ?? 2,
        maxTimesWithSameOpponent: input.maxTimesWithSameOpponent ?? 2,
        pointPerVictory: input.pointPerVictory ?? 3,
        pointPerDraw: input.pointPerDraw ?? 1,
        pointPerLoss: input.pointPerLoss ?? 0,
        allowDraw: input.allowDraw ?? true,
        startDate: input.startDate,
        endDate: input.endDate,
        createdBy: input.createdBy,
        status: "draft",
      })
      .returning();

    // Add creator as owner in tournament_admins
    await db.insert(tournamentAdmins).values({
      tournamentId: tournament.id,
      userId: input.createdBy,
      role: "owner",
    });

    return tournament;
  }

  /**
   * Get tournament by ID
   */
  async getTournamentById(id: string) {
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

    if (!tournament) {
      throw new Error("Tournament not found");
    }

    return tournament;
  }

  /**
   * List all tournaments (with optional filters)
   */
  async listTournaments(filters?: {
    status?: TournamentStatus;
    mode?: TournamentMode;
    createdBy?: string;
  }) {
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
  async updateTournament(
    id: string,
    userId: string,
    input: UpdateTournamentInput
  ) {
    // Check permissions
    const canManage = await this.canManageTournament(id, userId);
    if (!canManage) {
      throw new Error(
        "User does not have permission to update this tournament"
      );
    }

    // Get current tournament
    const tournament = await this.getTournamentById(id);

    // If tournament is not draft, restrict what can be changed
    if (tournament.status !== "draft") {
      // Can only update description and dates after draft
      const allowedFields = ["description", "startDate", "endDate", "status"];
      const attemptedFields = Object.keys(input);
      const invalidFields = attemptedFields.filter(
        (field) => !allowedFields.includes(field)
      );

      if (invalidFields.length > 0) {
        throw new Error(
          `Cannot update fields [${invalidFields.join(
            ", "
          )}] after tournament is no longer in draft status`
        );
      }
    }

    // Validate dates if provided
    if (input.startDate || input.endDate) {
      const startDate = new Date(input.startDate ?? tournament.startDate);
      const endDate = new Date(input.endDate ?? tournament.endDate);
      if (startDate >= endDate) {
        throw new Error("Start date must be before end date");
      }
    }

    // Validate team size if provided
    if (input.teamSize !== undefined) {
      if (input.teamSize < 1 || input.teamSize > 2) {
        throw new Error("Team size must be 1 or 2");
      }
    }

    // Update tournament
    const [updated] = await db
      .update(tournaments)
      .set({
        ...input,
        // Ensure dates are strings if provided
        startDate: input.startDate,
        endDate: input.endDate,
      })
      .where(eq(tournaments.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete tournament
   */
  async deleteTournament(id: string, userId: string) {
    // Check permissions - only owner or super_admin can delete
    const user = await db.query.appUsers.findFirst({
      where: eq(appUsers.id, userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    const tournament = await this.getTournamentById(id);

    // Super admin can delete anything
    const isSuperAdmin = user.role === "super_admin";
    // Owner can delete their tournament
    const isOwner = tournament.createdBy === userId;

    if (!isSuperAdmin && !isOwner) {
      throw new Error(
        "Only tournament owner or super_admin can delete tournaments"
      );
    }

    // Can only delete if status is draft
    if (tournament.status !== "draft") {
      throw new Error("Can only delete tournaments in draft status");
    }

    // Delete tournament (cascade will handle related records)
    await db.delete(tournaments).where(eq(tournaments.id, id));

    return { success: true, message: "Tournament deleted successfully" };
  }

  /**
   * Change tournament status
   */
  async changeTournamentStatus(
    id: string,
    userId: string,
    newStatus: TournamentStatus
  ) {
    const canManage = await this.canManageTournament(id, userId);
    if (!canManage) {
      throw new Error(
        "User does not have permission to manage this tournament"
      );
    }

    const tournament = await this.getTournamentById(id);

    // Validate status transitions
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      draft: ["open"],
      open: ["ongoing", "draft"],
      ongoing: ["finished"],
      finished: [], // Cannot change from finished
    };

    const allowedTransitions = validTransitions[tournament.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${tournament.status} to ${newStatus}`
      );
    }

    const [updated] = await db
      .update(tournaments)
      .set({ status: newStatus })
      .where(eq(tournaments.id, id))
      .returning();

    return updated;
  }
}

export const tournamentService = new TournamentService();
