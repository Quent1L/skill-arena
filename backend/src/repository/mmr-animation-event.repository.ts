import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "../config/database";
import { mmrAnimationEvents } from "../db/schema";

export interface UpsertMmrAnimationEventData {
  playerId: string;
  seasonId: string;
  matchId: string;
  eventType: "provisional" | "official";
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  tierBeforeLevel: number | null;
  tierAfterLevel: number | null;
  tierBeforeName: string | null;
  tierAfterName: string | null;
  rankChanged: boolean;
}

export class MmrAnimationEventRepository {
  async upsert(data: UpsertMmrAnimationEventData) {
    const [row] = await db
      .insert(mmrAnimationEvents)
      .values(data)
      .onConflictDoUpdate({
        target: [
          mmrAnimationEvents.playerId,
          mmrAnimationEvents.seasonId,
          mmrAnimationEvents.matchId,
          mmrAnimationEvents.eventType,
        ],
        set: {
          mmrBefore: data.mmrBefore,
          mmrAfter: data.mmrAfter,
          mmrDelta: data.mmrDelta,
          tierBeforeLevel: data.tierBeforeLevel,
          tierAfterLevel: data.tierAfterLevel,
          tierBeforeName: data.tierBeforeName,
          tierAfterName: data.tierAfterName,
          rankChanged: data.rankChanged,
          viewedAt: null,
        },
      })
      .returning();
    return row;
  }

  async getPendingForPlayer(playerId: string, seasonId: string) {
    return await db.query.mmrAnimationEvents.findMany({
      where: and(
        eq(mmrAnimationEvents.playerId, playerId),
        eq(mmrAnimationEvents.seasonId, seasonId),
        isNull(mmrAnimationEvents.viewedAt),
      ),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
  }

  async markViewed(ids: string[]) {
    if (ids.length === 0) return;
    await db
      .update(mmrAnimationEvents)
      .set({ viewedAt: new Date() })
      .where(inArray(mmrAnimationEvents.id, ids));
  }
}

export const mmrAnimationEventRepository = new MmrAnimationEventRepository();
