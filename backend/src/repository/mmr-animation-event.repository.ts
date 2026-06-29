import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { db } from "../config/database";
import { mmrAnimationEvents, matches, matchSides, tournamentEntries, tournamentEntryPlayers, appUsers } from "../db/schema";

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

  // Single round-trip insert for many events (recalc / cancellation cascade).
  // Same conflict target/set as upsert: re-syncs deltas and re-arms the
  // animation (viewedAt: null) so the player sees the recalculated matches.
  async bulkUpsert(rows: UpsertMmrAnimationEventData[]) {
    if (rows.length === 0) return [];
    return await db
      .insert(mmrAnimationEvents)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          mmrAnimationEvents.playerId,
          mmrAnimationEvents.seasonId,
          mmrAnimationEvents.matchId,
          mmrAnimationEvents.eventType,
        ],
        set: {
          mmrBefore: sql`excluded.mmr_before`,
          mmrAfter: sql`excluded.mmr_after`,
          mmrDelta: sql`excluded.mmr_delta`,
          tierBeforeLevel: sql`excluded.tier_before_level`,
          tierAfterLevel: sql`excluded.tier_after_level`,
          tierBeforeName: sql`excluded.tier_before_name`,
          tierAfterName: sql`excluded.tier_after_name`,
          rankChanged: sql`excluded.rank_changed`,
          reason: sql`excluded.reason`,
          viewedAt: sql`null`,
        },
      })
      .returning();
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
    if (events.length === 0) return events.map((e) => ({ ...e, opponents: [], teammates: [] }));
    const matchIds = events.map((e) => e.matchId);
    const { opponents, teammates } = await this.fetchMatchParticipants(matchIds, playerId);
    const playedAtMap = await this.fetchPlayedAtByMatchIds(matchIds);
    return events.map((e) => ({
      ...e,
      opponents: opponents.get(e.matchId) ?? [],
      teammates: teammates.get(e.matchId) ?? [],
      playedAt: playedAtMap.get(e.matchId),
    }));
  }

  private async fetchMatchParticipants(
    matchIds: string[],
    playerId: string,
  ): Promise<{
    opponents: Map<string, { id: string; displayName: string; shortName: string }[]>;
    teammates: Map<string, { id: string; displayName: string; shortName: string }[]>;
  }> {
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

    const mySideByMatch = new Map<string, number>();
    for (const row of rows) {
      if (row.playerId === playerId) mySideByMatch.set(row.matchId, row.sidePosition);
    }

    const opponents = new Map<string, { id: string; displayName: string; shortName: string }[]>();
    const teammates = new Map<string, { id: string; displayName: string; shortName: string }[]>();
    for (const row of rows) {
      const mySide = mySideByMatch.get(row.matchId);
      if (mySide === undefined || row.playerId === playerId) continue;
      const target = row.sidePosition === mySide ? teammates : opponents;
      const list = target.get(row.matchId) ?? [];
      list.push({ id: row.playerId, displayName: row.displayName, shortName: row.shortName });
      target.set(row.matchId, list);
    }
    return { opponents, teammates };
  }

  private async fetchPlayedAtByMatchIds(matchIds: string[]): Promise<Map<string, Date>> {
    const rows = await db
      .select({ id: matches.id, playedAt: matches.playedAt })
      .from(matches)
      .where(inArray(matches.id, matchIds));
    return new Map(rows.map((r) => [r.id, r.playedAt]));
  }

  async getOfficialEventDeltasByPlayer(
    seasonId: string,
    playerId: string,
  ): Promise<Map<string, { id: string; mmrDelta: number }>> {
    const rows = await db
      .select({
        id: mmrAnimationEvents.id,
        matchId: mmrAnimationEvents.matchId,
        mmrDelta: mmrAnimationEvents.mmrDelta,
      })
      .from(mmrAnimationEvents)
      .where(
        and(
          eq(mmrAnimationEvents.playerId, playerId),
          eq(mmrAnimationEvents.seasonId, seasonId),
          eq(mmrAnimationEvents.eventType, "official"),
        ),
      );
    return new Map(rows.map((r) => [r.matchId, { id: r.id, mmrDelta: r.mmrDelta }]));
  }

  // Multi-player variant of getOfficialEventDeltasByPlayer: one query for the
  // whole cascade. Returns playerId -> (matchId -> {id, mmrDelta}).
  async getOfficialEventDeltasForPlayers(
    seasonId: string,
    playerIds: string[],
  ): Promise<Map<string, Map<string, { id: string; mmrDelta: number }>>> {
    const result = new Map<string, Map<string, { id: string; mmrDelta: number }>>();
    if (playerIds.length === 0) return result;
    const rows = await db
      .select({
        id: mmrAnimationEvents.id,
        playerId: mmrAnimationEvents.playerId,
        matchId: mmrAnimationEvents.matchId,
        mmrDelta: mmrAnimationEvents.mmrDelta,
      })
      .from(mmrAnimationEvents)
      .where(
        and(
          eq(mmrAnimationEvents.seasonId, seasonId),
          inArray(mmrAnimationEvents.playerId, playerIds),
          eq(mmrAnimationEvents.eventType, "official"),
        ),
      );
    for (const r of rows) {
      const byMatch = result.get(r.playerId) ?? new Map();
      byMatch.set(r.matchId, { id: r.id, mmrDelta: r.mmrDelta });
      result.set(r.playerId, byMatch);
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

  async updateMessage(id: string, message: string) {
    await db.update(mmrAnimationEvents).set({ message }).where(eq(mmrAnimationEvents.id, id));
  }
}

export const mmrAnimationEventRepository = new MmrAnimationEventRepository();
