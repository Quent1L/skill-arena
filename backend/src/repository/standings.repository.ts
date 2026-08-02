import { eq, and, inArray } from "drizzle-orm";
import { db } from "../config/database";
import {
  tournaments,
  tournamentEntries,
  teams,
  matches,
  matchSides,
  matchPlayerPoints,
  computedData,
} from "../db/schema";
import { type MatchStatus, type StandingsResult } from "@skol-arena/shared";

export type PlayerPointRow = {
  matchId: string;
  playerId: string;
  pointsAwarded: number;
  countsForRanking: boolean;
};

export class StandingsRepository {
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

  async getTournamentTeams(tournamentId: string) {
    return await db.query.teams.findMany({
      where: eq(teams.tournamentId, tournamentId),
    });
  }

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
        outcomeTypeId: true,
      },
      with: {
        outcomeType: { columns: { isDefault: true, id: true, name: true, points: true } },
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

  async getPlayerPointsForStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[]
  ) {
    return await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        inArray(matches.status, includeStatuses)
      ),
      columns: { id: true, winnerSide: true, outcomeTypeId: true },
      with: {
        outcomeType: { columns: { isDefault: true, id: true, name: true, points: true } },
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
  }

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

  async insertPlayerPoints(rows: PlayerPointRow[]) {
    if (rows.length === 0) return;
    await db.insert(matchPlayerPoints).values(rows);
  }

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

  async getMatchSides(matchIds: string[]) {
    if (matchIds.length === 0) return [];

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

  // ── Computed data cache ──────────────────────────────────────────────

  async getComputedData(tournamentId: string, key: string): Promise<StandingsResult | null> {
    const row = await db.query.computedData.findFirst({
      where: and(
        eq(computedData.tournamentId, tournamentId),
        eq(computedData.key, key)
      ),
    });
    if (!row) return null;
    return row.data as StandingsResult;
  }

  async setComputedData(tournamentId: string, key: string, data: StandingsResult): Promise<void> {
    await db
      .insert(computedData)
      .values({ tournamentId, key, data, computedAt: new Date() })
      .onConflictDoUpdate({
        target: [computedData.tournamentId, computedData.key],
        set: { data, computedAt: new Date() },
      });
  }

  async deleteComputedData(tournamentId: string): Promise<void> {
    await db.delete(computedData).where(eq(computedData.tournamentId, tournamentId));
  }

  async deleteComputedDataMany(tournamentIds: string[]): Promise<void> {
    if (tournamentIds.length === 0) return;
    await db.delete(computedData).where(inArray(computedData.tournamentId, tournamentIds));
  }
}

export const standingsRepository = new StandingsRepository();
