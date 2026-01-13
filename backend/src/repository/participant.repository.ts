import { eq, and, sql } from "drizzle-orm";
import { db } from "../config/database";
import { tournaments, tournamentParticipants } from "../db/schema";

/**
 * Repository for tournament participation management
 *
 * Note: tournamentParticipants tracks user REGISTRATION (who CAN play)
 *       tournamentEntries tracks match COMPOSITION (who DID play)
 */
export class ParticipantRepository {
  /**
   * Get tournament by ID
   */
  async findTournamentById(tournamentId: string) {
    return await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });
  }

  /**
   * Check if user is already registered in tournament
   */
  async findParticipationByUserAndTournament(
    userId: string,
    tournamentId: string
  ) {
    return await db.query.tournamentParticipants.findFirst({
      where: and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, userId),
        eq(tournamentParticipants.status, "active")
      ),
    });
  }

  /**
   * Create a new participation (user joins tournament)
   */
  async createParticipation(userId: string, tournamentId: string) {
    const [participation] = await db
      .insert(tournamentParticipants)
      .values({
        tournamentId,
        userId,
        status: "active",
      })
      .returning();

    return participation;
  }

  /**
   * Get participation with related tournament and user details
   */
  async findParticipationWithDetails(participationId: string) {
    return await db.query.tournamentParticipants.findFirst({
      where: eq(tournamentParticipants.id, participationId),
      with: {
        tournament: true,
        user: true,
      },
    });
  }

  /**
   * Remove participation (soft delete - mark as withdrawn)
   */
  async deleteParticipation(participationId: string) {
    await db
      .update(tournamentParticipants)
      .set({ status: "withdrawn" })
      .where(eq(tournamentParticipants.id, participationId));
  }

  /**
   * Get all active participants for a tournament
   */
  async findTournamentParticipants(tournamentId: string) {
    return await db.query.tournamentParticipants.findMany({
      where: and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.status, "active")
      ),
      with: {
        user: true,
      },
      orderBy: (tournamentParticipants, { asc }) => [
        asc(tournamentParticipants.joinedAt),
      ],
    });
  }

  /**
   * Count active participants in a tournament
   */
  async countActiveParticipants(tournamentId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.status, "active")
        )
      );
    // Convert to number (PostgreSQL count returns bigint as string)
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Hard delete participation (for admin purposes)
   */
  async hardDeleteParticipation(participationId: string) {
    await db
      .delete(tournamentParticipants)
      .where(eq(tournamentParticipants.id, participationId));
  }
}

export const participantRepository = new ParticipantRepository();
