import { eq, and, sql } from "drizzle-orm";
import { db } from "../config/database";
import { matches, tournaments, outcomeTypes } from "../db/schema";

export class TournamentStatsRepository {
  async getTournamentMode(tournamentId: string) {
    return db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      columns: { mode: true, teamMode: true, startDate: true, endDate: true },
    });
  }

  async getOutcomeDistribution(tournamentId: string) {
    return db
      .select({
        outcomeTypeId: matches.outcomeTypeId,
        outcomeTypeName: outcomeTypes.name,
        isDefault: outcomeTypes.isDefault,
        count: sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(matches)
      .leftJoin(outcomeTypes, eq(matches.outcomeTypeId, outcomeTypes.id))
      .where(
        and(eq(matches.tournamentId, tournamentId), eq(matches.status, "finalized"))
      )
      .groupBy(matches.outcomeTypeId, outcomeTypes.name, outcomeTypes.isDefault);
  }

  async getMatchesWithSidesAndPlayers(tournamentId: string) {
    return db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        eq(matches.status, "finalized")
      ),
      columns: {
        id: true,
        winnerSide: true,
        playedAt: true,
        outcomeTypeId: true,
      },
      with: {
        outcomeType: {
          columns: { id: true, name: true, isDefault: true },
        },
        sides: {
          columns: { position: true, entryId: true },
          with: {
            entry: {
              columns: { id: true },
              with: {
                players: {
                  columns: { playerId: true },
                  with: {
                    player: {
                      columns: { id: true, displayName: true, shortName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getMomentum(tournamentId: string) {
    return db
      .select({
        date: sql<string>`DATE(${matches.playedAt})`,
        matchCount: sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(matches)
      .where(
        and(eq(matches.tournamentId, tournamentId), eq(matches.status, "finalized"))
      )
      .groupBy(sql`DATE(${matches.playedAt})`)
      .orderBy(sql`DATE(${matches.playedAt})`);
  }
}

export const tournamentStatsRepository = new TournamentStatsRepository();
