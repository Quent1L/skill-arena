import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../config/database";
import { playerMmr, mmrHistory, matches } from "../db/schema";

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
    return await db.query.playerMmr.findMany({
      where: eq(playerMmr.seasonId, seasonId),
      with: {
        player: true,
      },
      orderBy: (p, { desc }) => [desc(p.currentMmr)],
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

  async getMmrHistory(seasonId: string, playerId: string) {
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
      .orderBy(desc(matches.playedAt));
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
