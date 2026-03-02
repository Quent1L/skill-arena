import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../config/database";
import {
  appUsers,
  tournaments,
  tournamentEntries,
  tournamentEntryPlayers,
  matches,
  matchSides,
  disciplines,
  championshipStandings,
} from "../db/schema";

export class PlayerStatsRepository {
  async getPlayerProfile(playerId: string) {
    return db.query.appUsers.findFirst({
      where: eq(appUsers.id, playerId),
      columns: { id: true, displayName: true, shortName: true },
    });
  }

  async getPlayerEntries(
    playerId: string,
    filters?: { tournamentId?: string; disciplineId?: string; tournamentMode?: string }
  ) {
    const conditions = [eq(tournamentEntryPlayers.playerId, playerId)];

    const entries = await db
      .select({
        entryId: tournamentEntries.id,
        tournamentId: tournaments.id,
        tournamentName: tournaments.name,
        tournamentMode: tournaments.mode,
        disciplineId: tournaments.disciplineId,
        disciplineName: disciplines.name,
      })
      .from(tournamentEntryPlayers)
      .innerJoin(tournamentEntries, eq(tournamentEntryPlayers.entryId, tournamentEntries.id))
      .innerJoin(tournaments, eq(tournamentEntries.tournamentId, tournaments.id))
      .leftJoin(disciplines, eq(tournaments.disciplineId, disciplines.id))
      .where(and(...conditions));

    return entries.filter((e) => {
      if (filters?.tournamentId && e.tournamentId !== filters.tournamentId) return false;
      if (filters?.disciplineId && e.disciplineId !== filters.disciplineId) return false;
      if (filters?.tournamentMode && e.tournamentMode !== filters.tournamentMode) return false;
      return true;
    });
  }

  async getPlayerMatchResults(playerEntryIds: string[]) {
    if (playerEntryIds.length === 0) return [];

    return db
      .select({
        matchId: matchSides.matchId,
        entryId: matchSides.entryId,
        ownScore: matchSides.score,
        ownPosition: matchSides.position,
        winnerSide: matches.winnerSide,
        oppEntryId: sql<string>`ms2.entry_id`,
        oppScore: sql<number>`ms2.score`,
      })
      .from(matchSides)
      .innerJoin(sql`match_sides ms2`, sql`${matchSides.matchId} = ms2.match_id AND ms2.entry_id != ${matchSides.entryId}`)
      .innerJoin(matches, eq(matchSides.matchId, matches.id))
      .where(and(inArray(matchSides.entryId, playerEntryIds), eq(matches.status, "finalized")));
  }

  async getPlayersInEntries(entryIds: string[]) {
    if (entryIds.length === 0) return [];

    return db
      .select({
        entryId: tournamentEntryPlayers.entryId,
        playerId: tournamentEntryPlayers.playerId,
        displayName: appUsers.displayName,
        shortName: appUsers.shortName,
      })
      .from(tournamentEntryPlayers)
      .innerJoin(appUsers, eq(tournamentEntryPlayers.playerId, appUsers.id))
      .where(inArray(tournamentEntryPlayers.entryId, entryIds));
  }

  async getPlayerTournaments(playerId: string) {
    return db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        mode: tournaments.mode,
        disciplineId: tournaments.disciplineId,
        disciplineName: disciplines.name,
      })
      .from(tournamentEntryPlayers)
      .innerJoin(tournamentEntries, eq(tournamentEntryPlayers.entryId, tournamentEntries.id))
      .innerJoin(tournaments, eq(tournamentEntries.tournamentId, tournaments.id))
      .leftJoin(disciplines, eq(tournaments.disciplineId, disciplines.id))
      .where(eq(tournamentEntryPlayers.playerId, playerId))
      .groupBy(tournaments.id, disciplines.name);
  }

  async getPlayerStandingsForTournament(playerId: string, tournamentId: string) {
    const standings = await db
      .select({
        entryId: championshipStandings.entryId,
        points: championshipStandings.points,
        wins: championshipStandings.wins,
        losses: championshipStandings.losses,
        draws: championshipStandings.draws,
        matchesPlayed: championshipStandings.matchesPlayed,
      })
      .from(championshipStandings)
      .innerJoin(tournamentEntries, eq(championshipStandings.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(
        and(
          eq(tournamentEntryPlayers.playerId, playerId),
          eq(tournamentEntries.tournamentId, tournamentId)
        )
      );
    return standings[0] ?? null;
  }
}

export const playerStatsRepository = new PlayerStatsRepository();
