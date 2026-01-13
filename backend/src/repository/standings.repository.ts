import { eq, and, inArray } from "drizzle-orm";
import { db } from "../config/database";
import {
  tournaments,
  tournamentEntries,
  teams,
  matches,
  matchSides,
} from "../db/schema";
import { type MatchStatus } from "@skill-arena/shared";

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
    });
  }

  /**
   * Get all entries for a tournament
   */
  async getTournamentEntries(tournamentId: string) {
    return await db.query.tournamentEntries.findMany({
      where: eq(tournamentEntries.tournamentId, tournamentId),
      with: {
        team: true,
        players: {
          with: {
            player: true,
          },
        },
      },
    });
  }

  /**
   * Get matches for standings calculation
   * Returns matches with their sides
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
      },
    });
  }

  /**
   * Get match sides for standings calculation
   */
  async getMatchSides(matchIds: string[]) {
    if (matchIds.length === 0) {
      return [];
    }

    return await db.query.matchSides.findMany({
      where: inArray(matchSides.matchId, matchIds),
      with: {
        entry: {
          with: {
            team: true,
            players: {
              with: {
                player: true,
              },
            },
          },
        },
      },
      orderBy: (matchSides, { asc }) => [
        asc(matchSides.matchId),
        asc(matchSides.position),
      ],
    });
  }
}

export const standingsRepository = new StandingsRepository();

