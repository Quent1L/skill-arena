import { eq, and, inArray } from "drizzle-orm";
import { db } from "../config/database";
import {
  tournaments,
  tournamentEntries,
  teams,
  matches,
  matchSides,
  matchPlayerPoints,
} from "../db/schema";
import { type MatchStatus } from "@skill-arena/shared";

export type PlayerPointRow = {
  matchId: string;
  playerId: string;
  pointsAwarded: number;
  countsForRanking: boolean;
};

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
        scoreEnabled: true,
        maxMatchesPerPlayer: true,
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
   * Get matches with their sides in a single query (for static mode)
   */
  async getMatchesWithSides(
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
        winnerSide: true,
        playedAt: true,
      },
      with: {
        sides: {
          with: {
            entry: {
              with: {
                team: true,
                players: {
                  with: { player: true },
                },
              },
            },
          },
          orderBy: (s, { asc }) => [asc(s.position)],
        },
      },
    });
  }

  /**
   * Get per-player point rows for flex standings
   * Returns matchPlayerPoints joined with match winnerSide/playedAt and matchSide position/score
   */
  async getPlayerPointsForStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[]
  ) {
    const matchRows = await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        inArray(matches.status, includeStatuses)
      ),
      columns: { id: true, winnerSide: true },
      with: {
        playerPoints: {
          columns: {
            playerId: true,
            pointsAwarded: true,
            countsForRanking: true,
          },
        },
        sides: {
          columns: { position: true, score: true, entryId: true },
          with: {
            entry: {
              columns: { id: true },
              with: {
                players: { columns: { playerId: true } },
              },
            },
          },
        },
      },
    });

    return matchRows;
  }

  /**
   * Delete all matchPlayerPoints rows for a tournament's matches
   */
  async deletePlayerPointsForTournament(
    tournamentId: string,
    includeStatuses: MatchStatus[]
  ) {
    const matchIds = await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        inArray(matches.status, includeStatuses)
      ),
      columns: { id: true },
    });

    if (matchIds.length === 0) return;

    await db
      .delete(matchPlayerPoints)
      .where(inArray(matchPlayerPoints.matchId, matchIds.map((m) => m.id)));
  }

  /**
   * Batch insert matchPlayerPoints rows (replaces previous rows via delete+insert)
   */
  async insertPlayerPoints(rows: PlayerPointRow[]) {
    if (rows.length === 0) return;
    await db.insert(matchPlayerPoints).values(rows);
  }

  /**
   * Get matches for standings calculation (legacy, kept for recalculatePoints)
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
        winnerSide: true,
        playedAt: true,
      },
    });
  }

  /**
   * Get match sides for standings calculation (legacy, kept for recalculatePoints)
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
