import { eq } from "drizzle-orm";
import { db } from "../config/database";
import { teams, tournamentParticipants, appUsers } from "../db/schema";

export class TeamRepository {
  /**
   * Create a team for a participant (used in bracket mode for 1v1)
   */
  async createTeamForParticipant(
    tournamentId: string,
    userId: string,
    participantId: string
  ) {
    // Get user display name for team name
    const user = await db.query.appUsers.findFirst({
      where: eq(appUsers.id, userId),
    });

    const teamName = user?.displayName || `Player ${participantId.slice(0, 8)}`;

    // Create a team for this participant
    const [team] = await db
      .insert(teams)
      .values({
        tournamentId,
        name: teamName,
        createdBy: userId,
      })
      .returning();

    // Update participant to link to this team
    await db
      .update(tournamentParticipants)
      .set({ teamId: team.id })
      .where(eq(tournamentParticipants.id, participantId));

    return team;
  }

  /**
   * Get team by ID
   */
  async getById(id: string) {
    return await db.query.teams.findFirst({
      where: eq(teams.id, id),
    });
  }
}

export const teamRepository = new TeamRepository();
