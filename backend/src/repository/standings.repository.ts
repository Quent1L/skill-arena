import { eq, and, inArray } from "drizzle-orm";
import { db } from "../config/database";
import {
  tournaments,
  tournamentRegistrations,
  teams,
  matches,
  matchParticipants,
} from "../db/schema";
import { type MatchStatus } from "@skill-arena/shared/types/index";

export class StandingsRepository {
  /**
   * Get tournament with scoring rules
   */
  async getTournamentWithScoring(tournamentId: string) {
    return await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      columns: {
        id: true,
        mode: true,
        teamMode: true,
        pointPerVictory: true,
        pointPerDraw: true,
        pointPerLoss: true,
        allowDraw: true,
      },
    });
  }

  /**
   * Get all teams for a tournament (for static team mode)
   */
  async getTournamentTeams(tournamentId: string) {
    return await db.query.teams.findMany({
      where: eq(teams.tournamentId, tournamentId),
      with: {
        registrations: {
          with: {
            user: true,
          },
        },
      },
    });
  }

  /**
   * Get all participants for a tournament (for flex team mode)
   */
  async getTournamentParticipants(tournamentId: string) {
    return await db.query.tournamentRegistrations.findMany({
      where: eq(tournamentRegistrations.tournamentId, tournamentId),
      with: {
        user: true,
      },
    });
  }

  /**
   * Get matches for standings calculation
   * Includes only the specified statuses (finalized for official, reported + finalized for provisional)
   */
  async getMatchesForStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[]
  ) {
    return await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        inArray(matches.status, includeStatuses)
      ),
      columns: {
        id: true,
        status: true,
        bracketType: true,
      },
      with: {
        participants: {
          with: {
            players: {
              with: {
                player: true
              }
            }
          }
        }
      }
    });
  }
}

export const standingsRepository = new StandingsRepository();
