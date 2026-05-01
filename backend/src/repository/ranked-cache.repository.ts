import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { computedData } from "../db/schema";
import type { ClientPlayerMmr, ClientRankTier } from "@skill-arena/shared/types/index";

const KEY_OFFICIAL = "leaderboard:official";
const KEY_PROVISIONAL = "leaderboard:provisional";

export type LeaderboardCacheData = {
  players: ClientPlayerMmr[];
  tiers: ClientRankTier[];
};

export class RankedCacheRepository {
  async getOfficial(tournamentId: string): Promise<LeaderboardCacheData | null> {
    const row = await db.query.computedData.findFirst({
      where: and(eq(computedData.tournamentId, tournamentId), eq(computedData.key, KEY_OFFICIAL)),
    });
    return row ? (row.data as LeaderboardCacheData) : null;
  }

  async getProvisional(tournamentId: string): Promise<LeaderboardCacheData | null> {
    const row = await db.query.computedData.findFirst({
      where: and(eq(computedData.tournamentId, tournamentId), eq(computedData.key, KEY_PROVISIONAL)),
    });
    return row ? (row.data as LeaderboardCacheData) : null;
  }

  async upsertOfficial(tournamentId: string, data: LeaderboardCacheData): Promise<void> {
    await db
      .insert(computedData)
      .values({ tournamentId, key: KEY_OFFICIAL, data: data as object, computedAt: new Date() })
      .onConflictDoUpdate({
        target: [computedData.tournamentId, computedData.key],
        set: { data: data as object, computedAt: new Date() },
      });
  }

  async upsertProvisional(tournamentId: string, data: LeaderboardCacheData): Promise<void> {
    await db
      .insert(computedData)
      .values({ tournamentId, key: KEY_PROVISIONAL, data: data as object, computedAt: new Date() })
      .onConflictDoUpdate({
        target: [computedData.tournamentId, computedData.key],
        set: { data: data as object, computedAt: new Date() },
      });
  }
}

export const rankedCacheRepository = new RankedCacheRepository();
