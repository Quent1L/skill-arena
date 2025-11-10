import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { tournaments, tournamentParticipants, appUsers } from "../db/schema";

export class ParticipantRepository {
  async findTournamentById(tournamentId: string) {
    return await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .then((rows) => rows[0]);
  }

  async findParticipationByUserAndTournament(
    userId: string,
    tournamentId: string
  ) {
    return await db
      .select()
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.userId, userId)
        )
      )
      .then((rows) => rows[0]);
  }

  async createParticipation(userId: string, tournamentId: string) {
    const [participation] = await db
      .insert(tournamentParticipants)
      .values({
        tournamentId,
        userId,
      })
      .returning();

    return participation;
  }

  async findParticipationWithDetails(participationId: string) {
    return await db
      .select({
        id: tournamentParticipants.id,
        tournamentId: tournamentParticipants.tournamentId,
        userId: tournamentParticipants.userId,
        teamId: tournamentParticipants.teamId,
        matchesPlayed: tournamentParticipants.matchesPlayed,
        joinedAt: tournamentParticipants.joinedAt,
        tournament: {
          id: tournaments.id,
          name: tournaments.name,
          status: tournaments.status,
          mode: tournaments.mode,
        },
        user: {
          id: appUsers.id,
          displayName: appUsers.displayName,
        },
      })
      .from(tournamentParticipants)
      .innerJoin(
        tournaments,
        eq(tournamentParticipants.tournamentId, tournaments.id)
      )
      .innerJoin(appUsers, eq(tournamentParticipants.userId, appUsers.id))
      .where(eq(tournamentParticipants.id, participationId))
      .then((rows) => rows[0]);
  }

  async deleteParticipation(participationId: string) {
    await db
      .delete(tournamentParticipants)
      .where(eq(tournamentParticipants.id, participationId));
  }

  async findTournamentParticipants(tournamentId: string) {
    return await db
      .select({
        id: tournamentParticipants.id,
        userId: tournamentParticipants.userId,
        teamId: tournamentParticipants.teamId,
        matchesPlayed: tournamentParticipants.matchesPlayed,
        joinedAt: tournamentParticipants.joinedAt,
        user: {
          id: appUsers.id,
          displayName: appUsers.displayName,
        },
      })
      .from(tournamentParticipants)
      .innerJoin(appUsers, eq(tournamentParticipants.userId, appUsers.id))
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
  }
}

export const participantRepository = new ParticipantRepository();
