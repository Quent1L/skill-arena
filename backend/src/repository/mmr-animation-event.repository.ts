import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "../config/database";
import { mmrAnimationEvents, matchSides, tournamentEntries, tournamentEntryPlayers, appUsers } from "../db/schema";

export interface UpsertMmrAnimationEventData {
  playerId: string;
  seasonId: string;
  matchId: string;
  eventType: "provisional" | "official";
  reason: string;
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
          reason: data.reason,
          viewedAt: null,
        },
      })
      .returning();
    return row;
  }

  async getPendingForPlayer(playerId: string, seasonId: string) {
    const events = await db.query.mmrAnimationEvents.findMany({
      where: and(
        eq(mmrAnimationEvents.playerId, playerId),
        eq(mmrAnimationEvents.seasonId, seasonId),
        isNull(mmrAnimationEvents.viewedAt),
      ),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
    if (events.length === 0) return events.map((e) => ({ ...e, opponents: [] }));
    const opponentMap = await this.fetchOpponentsByMatchIds(events.map((e) => e.matchId), playerId);
    return events.map((e) => ({ ...e, opponents: opponentMap.get(e.matchId) ?? [] }));
  }

  private async fetchOpponentsByMatchIds(
    matchIds: string[],
    playerId: string,
  ): Promise<Map<string, { id: string; displayName: string; shortName: string }[]>> {
    const rows = await db
      .select({
        matchId: matchSides.matchId,
        sidePosition: matchSides.position,
        playerId: tournamentEntryPlayers.playerId,
        displayName: appUsers.displayName,
        shortName: appUsers.shortName,
      })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .innerJoin(appUsers, eq(tournamentEntryPlayers.playerId, appUsers.id))
      .where(inArray(matchSides.matchId, matchIds));

    // Find which side the current player is on per match, then return the other side
    const mySideByMatch = new Map<string, number>();
    for (const row of rows) {
      if (row.playerId === playerId) mySideByMatch.set(row.matchId, row.sidePosition);
    }

    const result = new Map<string, { id: string; displayName: string; shortName: string }[]>();
    for (const row of rows) {
      const mySide = mySideByMatch.get(row.matchId);
      if (mySide === undefined || row.sidePosition === mySide) continue;
      const list = result.get(row.matchId) ?? [];
      list.push({ id: row.playerId, displayName: row.displayName, shortName: row.shortName });
      result.set(row.matchId, list);
    }
    return result;
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
