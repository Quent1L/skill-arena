import { eq, and, desc, asc, sql, inArray, lt, gte } from "drizzle-orm";
import { db } from "../config/database";
import { playerMmr, mmrHistory, matches, matchSides } from "../db/schema";
import type { MmrHistoryOutcome, OpponentQualityStats } from "@skol-arena/shared";

export interface UpsertPlayerMmrData {
  seasonId: string;
  playerId: string;
  currentMmr: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winStreak: number;
  maxWinStreak: number;
  lossStreak: number;
  maxLossStreak: number;
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
  outcome?: MmrHistoryOutcome | null;
  // Player state AFTER this match (for historical badge replay)
  winStreakAfter: number;
  lossStreakAfter: number;
  matchesPlayedAfter: number;
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
    return db.transaction(async (tx) => {
      const players = await tx.query.playerMmr.findMany({
        where: eq(playerMmr.seasonId, seasonId),
        with: { player: true },
        orderBy: (p, { desc }) => [desc(p.currentMmr)],
      });

      if (players.length === 0) return players;

      const recentRows = await tx.execute(sql`
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
        let outcome: 'win' | 'loss' | 'draw' = 'draw';
        if (delta > 0) outcome = 'win';
        else if (delta < 0) outcome = 'loss';
        list.push({ outcome });
        resultsByPlayer.set(row.player_id, list);
      }

      return players.map((p) => ({
        ...p,
        recentResults: (resultsByPlayer.get(p.playerId) ?? []).slice().reverse(),
      }));
    });
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
          lossStreak: data.lossStreak,
          maxLossStreak: data.maxLossStreak,
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

  async getMmrChartSeries(seasonId: string, playerId: string) {
    return await db
      .select({
        mmrAfter: mmrHistory.mmrAfter,
        mmrDelta: mmrHistory.mmrDelta,
        outcome: mmrHistory.outcome,
        playedAt: matches.playedAt,
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

  /** Distinct finalized-match ids of a season that have MMR history, oldest first. */
  async getSeasonMatchIdsOrdered(seasonId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ matchId: mmrHistory.matchId, playedAt: matches.playedAt })
      .from(mmrHistory)
      .innerJoin(matches, eq(mmrHistory.matchId, matches.id))
      .where(eq(mmrHistory.seasonId, seasonId))
      .orderBy(asc(matches.playedAt));
    return rows.map((r) => r.matchId);
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

  async deleteMmrHistoryForPlayer(seasonId: string, playerId: string, fromPlayedAt?: Date) {
    if (fromPlayedAt) {
      const matchIds = await db
        .select({ id: matches.id })
        .from(matches)
        .where(and(eq(matches.tournamentId, seasonId), gte(matches.playedAt, fromPlayedAt)));
      const ids = matchIds.map((r) => r.id);
      if (ids.length === 0) return;
      await db
        .delete(mmrHistory)
        .where(
          and(
            eq(mmrHistory.seasonId, seasonId),
            eq(mmrHistory.playerId, playerId),
            inArray(mmrHistory.matchId, ids),
          ),
        );
    } else {
      await db
        .delete(mmrHistory)
        .where(
          and(
            eq(mmrHistory.seasonId, seasonId),
            eq(mmrHistory.playerId, playerId),
          ),
        );
    }
  }

  async getCheckpointState(
    seasonId: string,
    playerId: string,
    beforePlayedAt: Date,
  ): Promise<{ mmr: number; wins: number; losses: number; winStreak: number; maxWinStreak: number; lossStreak: number; maxLossStreak: number } | null> {
    const rows = await db
      .select({ mmrAfter: mmrHistory.mmrAfter, outcome: mmrHistory.outcome })
      .from(mmrHistory)
      .innerJoin(matches, eq(mmrHistory.matchId, matches.id))
      .where(
        and(
          eq(mmrHistory.seasonId, seasonId),
          eq(mmrHistory.playerId, playerId),
          lt(matches.playedAt, beforePlayedAt),
        ),
      )
      .orderBy(asc(matches.playedAt));

    if (rows.length === 0) return null;

    let wins = 0, losses = 0, winStreak = 0, maxWinStreak = 0, lossStreak = 0, maxLossStreak = 0;
    for (const row of rows) {
      if (row.outcome === 'win') {
        wins++; winStreak++; maxWinStreak = Math.max(maxWinStreak, winStreak); lossStreak = 0;
      } else if (row.outcome === 'loss') {
        losses++; winStreak = 0; lossStreak++; maxLossStreak = Math.max(maxLossStreak, lossStreak);
      }
    }

    return { mmr: rows[rows.length - 1].mmrAfter, wins, losses, winStreak, maxWinStreak, lossStreak, maxLossStreak };
  }

  async preloadOpponentHistories(
    seasonId: string,
    matchIds: string[],
    opponentIds: string[],
  ): Promise<Map<string, number>> {
    if (matchIds.length === 0 || opponentIds.length === 0) return new Map();
    const rows = await db
      .select({ playerId: mmrHistory.playerId, matchId: mmrHistory.matchId, mmrBefore: mmrHistory.mmrBefore })
      .from(mmrHistory)
      .where(
        and(
          eq(mmrHistory.seasonId, seasonId),
          inArray(mmrHistory.matchId, matchIds),
          inArray(mmrHistory.playerId, opponentIds),
        ),
      );
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(`${row.playerId}:${row.matchId}`, row.mmrBefore);
    }
    return map;
  }

  async getPlayerCurrentMmrs(
    seasonId: string,
    playerIds: string[],
  ): Promise<Map<string, number>> {
    if (playerIds.length === 0) return new Map();
    const rows = await db.query.playerMmr.findMany({
      where: and(eq(playerMmr.seasonId, seasonId), inArray(playerMmr.playerId, playerIds)),
    });
    return new Map(rows.map((r) => [r.playerId, r.currentMmr]));
  }

  async deleteBySeasonAndPlayer(seasonId: string, playerId: string): Promise<void> {
    await db
      .delete(playerMmr)
      .where(and(eq(playerMmr.seasonId, seasonId), eq(playerMmr.playerId, playerId)));
  }

  async getAllPlayersBySeasonId(seasonId: string) {
    return await db.query.playerMmr.findMany({
      where: eq(playerMmr.seasonId, seasonId),
    });
  }

  async getOpponentQualityStats(seasonId: string, playerId: string): Promise<OpponentQualityStats> {
    const emptyBucket = () => ({ wins: 0, losses: 0, draws: 0, matchesPlayed: 0, winRate: 0 });
    const result = { vsStronger: emptyBucket(), vsEqual: emptyBucket(), vsWeaker: emptyBucket() };

    const rows = await db
      .select({ mmrBefore: mmrHistory.mmrBefore, opponentAvgMmr: mmrHistory.opponentAvgMmr, outcome: mmrHistory.outcome })
      .from(mmrHistory)
      .where(and(eq(mmrHistory.seasonId, seasonId), eq(mmrHistory.playerId, playerId)));

    const THRESHOLD = 100;
    for (const row of rows) {
      const diff = row.opponentAvgMmr - row.mmrBefore;
      let bucket = result.vsEqual;
      if (diff > THRESHOLD) bucket = result.vsStronger;
      else if (diff < -THRESHOLD) bucket = result.vsWeaker;
      bucket.matchesPlayed++;
      if (row.outcome === 'win') bucket.wins++;
      else if (row.outcome === 'loss') bucket.losses++;
      else bucket.draws++;
    }

    for (const b of [result.vsStronger, result.vsEqual, result.vsWeaker]) {
      b.winRate = b.matchesPlayed > 0 ? Math.round((b.wins / b.matchesPlayed) * 100) : 0;
    }

    return result;
  }
}

export const playerMmrRepository = new PlayerMmrRepository();
