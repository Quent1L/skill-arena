import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "../config/database";
import { playerMmr, mmrHistory, matches, matchSides } from "../db/schema";

export interface UpsertPlayerMmrData {
  seasonId: string;
  playerId: string;
  currentMmr: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winStreak: number;
  maxWinStreak: number;
}

export interface CreateMmrHistoryData {
  seasonId: string;
  playerId: string;
  matchId: string;
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  kEffective: number;
  opponentAvgMmr: number;
  isPlacement: boolean;
}

export class PlayerMmrRepository {
  async getBySeasonAndPlayer(seasonId: string, playerId: string) {
    return await db.query.playerMmr.findFirst({
      where: and(
        eq(playerMmr.seasonId, seasonId),
        eq(playerMmr.playerId, playerId),
      ),
    });
  }

  async getBySeasonOrdered(seasonId: string) {
    const players = await db.query.playerMmr.findMany({
      where: eq(playerMmr.seasonId, seasonId),
      with: { player: true },
      orderBy: (p, { desc }) => [desc(p.currentMmr)],
    });

    if (players.length === 0) return players;

    const recentRows = await db.execute(sql`
      SELECT player_id, mmr_delta
      FROM (
        SELECT mh.player_id, mh.mmr_delta,
          ROW_NUMBER() OVER (PARTITION BY mh.player_id ORDER BY m.played_at DESC) AS rn
        FROM mmr_history mh
        INNER JOIN matches m ON m.id = mh.match_id
        WHERE mh.season_id = ${seasonId}
      ) sub
      WHERE rn <= 5
    `);

    const resultsByPlayer = new Map<string, { outcome: 'win' | 'loss' | 'draw' }[]>();
    for (const row of recentRows.rows as { player_id: string; mmr_delta: number }[]) {
      const list = resultsByPlayer.get(row.player_id) ?? [];
      const delta = Number(row.mmr_delta);
      list.push({ outcome: delta > 0 ? 'win' : delta < 0 ? 'loss' : 'draw' });
      resultsByPlayer.set(row.player_id, list);
    }

    return players.map((p) => ({
      ...p,
      recentResults: (resultsByPlayer.get(p.playerId) ?? []).slice().reverse(),
    }));
  }

  async upsert(data: UpsertPlayerMmrData) {
    const existing = await this.getBySeasonAndPlayer(
      data.seasonId,
      data.playerId,
    );
    if (existing) {
      const [updated] = await db
        .update(playerMmr)
        .set({
          currentMmr: data.currentMmr,
          matchesPlayed: data.matchesPlayed,
          wins: data.wins,
          losses: data.losses,
          winStreak: data.winStreak,
          maxWinStreak: data.maxWinStreak,
        })
        .where(eq(playerMmr.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(playerMmr)
      .values(data)
      .returning();
    return created;
  }

  async getMmrHistory(seasonId: string, playerId: string, limit = 10, offset = 0) {
    return await db
      .select({
        id: mmrHistory.id,
        seasonId: mmrHistory.seasonId,
        playerId: mmrHistory.playerId,
        matchId: mmrHistory.matchId,
        mmrBefore: mmrHistory.mmrBefore,
        mmrAfter: mmrHistory.mmrAfter,
        mmrDelta: mmrHistory.mmrDelta,
        kEffective: mmrHistory.kEffective,
        opponentAvgMmr: mmrHistory.opponentAvgMmr,
        isPlacement: mmrHistory.isPlacement,
        match: {
          id: matches.id,
          playedAt: matches.playedAt,
          status: matches.status,
        },
        teamSizeA: sql<number>`(
          SELECT COUNT(*) FROM tournament_entry_players tep
          JOIN match_sides ms ON ms.entry_id = tep.entry_id
          WHERE ms.match_id = ${matches.id} AND ms.position = 1
        )`.mapWith(Number),
        teamSizeB: sql<number>`(
          SELECT COUNT(*) FROM tournament_entry_players tep
          JOIN match_sides ms ON ms.entry_id = tep.entry_id
          WHERE ms.match_id = ${matches.id} AND ms.position = 2
        )`.mapWith(Number),
      })
      .from(mmrHistory)
      .innerJoin(matches, eq(mmrHistory.matchId, matches.id))
      .where(
        and(
          eq(mmrHistory.seasonId, seasonId),
          eq(mmrHistory.playerId, playerId),
        ),
      )
      .orderBy(desc(matches.playedAt))
      .limit(limit)
      .offset(offset);
  }

  async getMmrHistoryOrdered(seasonId: string, playerId: string) {
    return await db
      .select({
        id: mmrHistory.id,
        seasonId: mmrHistory.seasonId,
        playerId: mmrHistory.playerId,
        matchId: mmrHistory.matchId,
        mmrBefore: mmrHistory.mmrBefore,
        mmrAfter: mmrHistory.mmrAfter,
        mmrDelta: mmrHistory.mmrDelta,
        kEffective: mmrHistory.kEffective,
        opponentAvgMmr: mmrHistory.opponentAvgMmr,
        isPlacement: mmrHistory.isPlacement,
        match: {
          id: matches.id,
          playedAt: matches.playedAt,
          status: matches.status,
        },
      })
      .from(mmrHistory)
      .innerJoin(matches, eq(mmrHistory.matchId, matches.id))
      .where(
        and(
          eq(mmrHistory.seasonId, seasonId),
          eq(mmrHistory.playerId, playerId),
        ),
      )
      .orderBy(asc(matches.playedAt));
  }

  async createMmrHistory(data: CreateMmrHistoryData) {
    const [created] = await db
      .insert(mmrHistory)
      .values(data)
      .returning();
    return created;
  }

  async getMatchPlayersForHistory(matchIds: string[]) {
    if (matchIds.length === 0) return [];
    return await db.query.matchSides.findMany({
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

  async getMmrHistoryForPlayerAndMatch(seasonId: string, playerId: string, matchId: string) {
    return await db.query.mmrHistory.findFirst({
      where: and(
        eq(mmrHistory.seasonId, seasonId),
        eq(mmrHistory.playerId, playerId),
        eq(mmrHistory.matchId, matchId),
      ),
    });
  }

  async deleteMmrHistoryForPlayer(seasonId: string, playerId: string) {
    await db
      .delete(mmrHistory)
      .where(
        and(
          eq(mmrHistory.seasonId, seasonId),
          eq(mmrHistory.playerId, playerId),
        ),
      );
  }

  async getAllPlayersBySeasonId(seasonId: string) {
    return await db.query.playerMmr.findMany({
      where: eq(playerMmr.seasonId, seasonId),
    });
  }
}

export const playerMmrRepository = new PlayerMmrRepository();
