import { eq, and, inArray, sql, desc, max } from "drizzle-orm";
import { db } from "../config/database";
import {
  appUsers,
  tournaments,
  tournamentEntries,
  tournamentEntryPlayers,
  matches,
  matchSides,
  disciplines,
  mmrHistory,
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
        allowDraw: tournaments.allowDraw,
        pointsAwarded: matchSides.pointsAwarded,
      })
      .from(matchSides)
      .innerJoin(sql`match_sides ms2`, sql`${matchSides.matchId} = ms2.match_id AND ms2.entry_id != ${matchSides.entryId}`)
      .innerJoin(matches, eq(matchSides.matchId, matches.id))
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournaments, eq(tournamentEntries.tournamentId, tournaments.id))
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

  async getPlayerMatchHistory(
    playerId: string,
    filters: { limit?: number; offset?: number; tournamentId?: string },
  ) {
    const { limit = 10, offset = 0, tournamentId } = filters;

    const conditions = [eq(tournamentEntryPlayers.playerId, playerId)];
    if (tournamentId) {
      conditions.push(eq(matches.tournamentId, tournamentId));
    }

    // Use GROUP BY to deduplicate matches (a player may appear multiple times
    // via different entry_player rows). All non-aggregate fields are deterministic
    // per match (same tournament, same playedAt, etc.) so MAX() is just a formality.
    return db
      .select({
        matchId: matches.id,
        tournamentId: tournaments.id,
        tournamentName: tournaments.name,
        tournamentMode: tournaments.mode,
        tournamentScoreEnabled: tournaments.scoreEnabled,
        playedAt: max(matches.playedAt),
        status: max(matches.status),
        winnerSide: max(matches.winnerSide),
        scoreA: sql<number | null>`(SELECT score FROM match_sides WHERE match_id = ${matches.id} AND position = 1 LIMIT 1)`,
        scoreB: sql<number | null>`(SELECT score FROM match_sides WHERE match_id = ${matches.id} AND position = 2 LIMIT 1)`,
        teamSizeA: sql<number>`(
          SELECT COUNT(*) FROM tournament_entry_players tep2
          JOIN match_sides ms2 ON ms2.entry_id = tep2.entry_id
          WHERE ms2.match_id = ${matches.id} AND ms2.position = 1
        )`.mapWith(Number),
        teamSizeB: sql<number>`(
          SELECT COUNT(*) FROM tournament_entry_players tep2
          JOIN match_sides ms2 ON ms2.entry_id = tep2.entry_id
          WHERE ms2.match_id = ${matches.id} AND ms2.position = 2
        )`.mapWith(Number),
        mmrDelta: sql<number | null>`(
          SELECT mmr_delta FROM mmr_history
          WHERE match_id = ${matches.id} AND player_id = ${playerId}
          LIMIT 1
        )`,
        outcomeTypeId: matches.outcomeTypeId,
        outcomeTypeName: sql<string | null>`(
          SELECT name FROM outcome_types
          WHERE id = ${matches.outcomeTypeId}
          LIMIT 1
        )`,
      })
      .from(tournamentEntryPlayers)
      .innerJoin(tournamentEntries, eq(tournamentEntryPlayers.entryId, tournamentEntries.id))
      .innerJoin(matchSides, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(matches, eq(matchSides.matchId, matches.id))
      .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
      .where(and(...conditions))
      .groupBy(matches.id, tournaments.id, tournaments.name, tournaments.mode, tournaments.scoreEnabled)
      .orderBy(desc(max(matches.playedAt)))
      .limit(limit)
      .offset(offset);
  }

  async getMatchPlayersForSides(matchIds: string[]) {
    if (matchIds.length === 0) return [];
    return db.query.matchSides.findMany({
      where: inArray(matchSides.matchId, matchIds),
      with: {
        entry: {
          with: {
            players: {
              with: { player: true },
            },
          },
        },
      },
    });
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

}

export const playerStatsRepository = new PlayerStatsRepository();
