import { eq } from "drizzle-orm";
import { db } from "../config/database";
import { teams, tournamentRegistrations, appUsers } from "../db/schema";

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
      .update(tournamentRegistrations)
      .set({ teamId: team.id })
      .where(eq(tournamentRegistrations.id, participantId));

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
  /**
   * Get team members user IDs
   */
  async getTeamMembers(teamId: string): Promise<string[]> {
    const members = await db
      .select({ userId: tournamentRegistrations.userId })
      .from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.teamId, teamId));

    return members.map((m) => m.userId);
  }
}

export const teamRepository = new TeamRepository();
