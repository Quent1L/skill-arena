import { eq, and, ilike } from "drizzle-orm";
import { db } from "../config/database";
import { tournaments, tournamentEntries, appUsers, tournamentEntryPlayers, teams, entryTypeEnum } from "../db/schema";

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
    // Find entry where user is a player
    const result = await db
      .select({
        entry: tournamentEntries
      })
      .from(tournamentEntries)
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(
        and(
          eq(tournamentEntries.tournamentId, tournamentId),
          eq(tournamentEntryPlayers.playerId, userId)
        )
      );

    return result[0]?.entry;
  }

  async createParticipation(userId: string, tournamentId: string, teamId?: string) {
    // If individual entry
    if (!teamId) {
      return await db.transaction(async (tx) => {
        const [entry] = await tx.insert(tournamentEntries).values({
          tournamentId,
          entryType: "PLAYER",
        }).returning();

        await tx.insert(tournamentEntryPlayers).values({
          entryId: entry.id,
          playerId: userId
        });
        return entry;
      });
    } else {
      // Team entry
      const [entry] = await db.insert(tournamentEntries).values({
        tournamentId,
        entryType: "TEAM",
        teamId
      }).returning();

      // Assuming team members are already handled or will be added separately?
      // For now, returning entry.
      return entry;
    }

  }

  /**
   * Get participation details (Entry + Players + Team)
   */
  async findParticipationWithDetails(participationId: string) {
    const result = await db.query.tournamentEntries.findFirst({
      where: eq(tournamentEntries.id, participationId),
      with: {
        tournament: true,
        team: true,
        players: {
          with: {
            player: true
          }
        }
      }
    });

    if (!result) return null;

    // Compatibility mapping
    return {
      ...result,
      user: result.players[0]?.player,
      userId: result.players[0]?.playerId
    };
  }

  async deleteParticipation(participationId: string) {
    await db
      .delete(tournamentEntries)
      .where(eq(tournamentEntries.id, participationId));
  }

  async findTournamentParticipants(tournamentId: string) {
    const entries = await db.query.tournamentEntries.findMany({
      where: eq(tournamentEntries.tournamentId, tournamentId),
      with: {
        team: true,
        players: {
          with: {
            player: true
          }
        }
      }
    });

    // Map to expected format if needed, or return entries
    return entries.map(e => ({
      ...e,
      user: e.players[0]?.player, // For single player entries compatibility
      userId: e.players[0]?.playerId
    }));
  }

  /**
   * Search users by display name (for admin participant addition)
   */
  async searchUsers(query: string, limit = 10) {
    return await db
      .select({
        id: appUsers.id,
        displayName: appUsers.displayName,
      })
      .from(appUsers)
      .where(ilike(appUsers.displayName, `%${query}%`))
      .limit(limit);
  }

  /**
   * Find user by ID
   */
  async findUserById(userId: string) {
    return await db
      .select({
        id: appUsers.id,
        displayName: appUsers.displayName,
      })
      .from(appUsers)
      .where(eq(appUsers.id, userId))
      .then((rows) => rows[0]);
  }
}

export const participantRepository = new ParticipantRepository();
