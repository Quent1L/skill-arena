import { and, asc, desc, eq, gt, isNull, notInArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type {
  MmrHistoryOutcome,
  PlayerRewindPayload,
  RewindArchiveEntry,
  RewindPromotion,
  SeasonRewindPayload,
} from "@skol-arena/shared/types/index";
import { db } from "../config/database";
import type * as schema from "../db/schema";
import {
  disciplines,
  matches,
  matchSides,
  mmrHistory,
  playerSeasonRewinds,
  seasonRewinds,
  tournamentEntryPlayers,
  tournaments,
} from "../db/schema";

type DbTransaction = NodePgDatabase<typeof schema> | typeof db;

/** Postgres caps a statement's parameters, so player payloads go in by chunks. */
const UPSERT_CHUNK_SIZE = 100;

export interface PlayerRewindRow {
  playerId: string;
  payload: PlayerRewindPayload;
  promotedUntil: Date;
}

export interface StoredPlayerRewind {
  payload: PlayerRewindPayload;
  version: number;
  promotedUntil: Date;
  openedAt: Date | null;
  viewedAt: Date | null;
}

/** One MMR history row, in the chronological order the replay needs. */
export interface SeasonHistoryRow {
  playerId: string;
  matchId: string;
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  opponentAvgMmr: number;
  isPlacement: boolean;
  outcome: MmrHistoryOutcome | null;
  playedAt: Date;
}

/** Who played on which side of a season match. */
export interface SeasonSideRow {
  matchId: string;
  position: number;
  playerId: string;
}

export class SeasonRewindRepository {
  /**
   * Every MMR history row of the season, ordered exactly like the deterministic
   * recalculation orders matches (played_at, then match id as a stable
   * tie-break). The replay depends on that order being reproducible: two
   * generations over identical data must produce identical awards.
   */
  async getSeasonHistoryOrdered(seasonId: string): Promise<SeasonHistoryRow[]> {
    const rows = await db
      .select({
        playerId: mmrHistory.playerId,
        matchId: mmrHistory.matchId,
        mmrBefore: mmrHistory.mmrBefore,
        mmrAfter: mmrHistory.mmrAfter,
        mmrDelta: mmrHistory.mmrDelta,
        opponentAvgMmr: mmrHistory.opponentAvgMmr,
        isPlacement: mmrHistory.isPlacement,
        outcome: mmrHistory.outcome,
        playedAt: matches.playedAt,
      })
      .from(mmrHistory)
      .innerJoin(matches, eq(mmrHistory.matchId, matches.id))
      .where(eq(mmrHistory.seasonId, seasonId))
      .orderBy(asc(matches.playedAt), asc(mmrHistory.matchId));

    return rows.map((row) => ({
      ...row,
      outcome: (row.outcome as MmrHistoryOutcome | null) ?? null,
    }));
  }

  /** Side composition of every season match that has MMR history. */
  async getSeasonSides(seasonId: string): Promise<SeasonSideRow[]> {
    return await db
      .selectDistinct({
        matchId: matchSides.matchId,
        position: matchSides.position,
        playerId: tournamentEntryPlayers.playerId,
      })
      .from(matchSides)
      .innerJoin(matches, eq(matchSides.matchId, matches.id))
      .innerJoin(
        tournamentEntryPlayers,
        eq(tournamentEntryPlayers.entryId, matchSides.entryId),
      )
      .where(eq(matches.tournamentId, seasonId));
  }

  async getSeasonRewind(seasonId: string): Promise<{
    id: string;
    payload: SeasonRewindPayload;
    version: number;
    disciplineId: string | null;
  } | null> {
    const row = await db.query.seasonRewinds.findFirst({
      where: and(eq(seasonRewinds.seasonId, seasonId), eq(seasonRewinds.scope, "season")),
    });
    if (!row) return null;
    return {
      id: row.id,
      payload: row.payload as SeasonRewindPayload,
      version: row.version,
      disciplineId: row.disciplineId,
    };
  }

  async getPlayerRewind(
    seasonId: string,
    playerId: string,
  ): Promise<StoredPlayerRewind | null> {
    const [row] = await db
      .select({
        payload: playerSeasonRewinds.payload,
        version: playerSeasonRewinds.version,
        promotedUntil: playerSeasonRewinds.promotedUntil,
        openedAt: playerSeasonRewinds.openedAt,
        viewedAt: playerSeasonRewinds.viewedAt,
      })
      .from(playerSeasonRewinds)
      .innerJoin(seasonRewinds, eq(playerSeasonRewinds.rewindId, seasonRewinds.id))
      .where(
        and(
          eq(seasonRewinds.seasonId, seasonId),
          eq(seasonRewinds.scope, "season"),
          eq(playerSeasonRewinds.playerId, playerId),
        ),
      )
      .limit(1);

    if (!row) return null;
    return { ...row, payload: row.payload as PlayerRewindPayload };
  }

  async upsertSeasonRewind(
    seasonId: string,
    disciplineId: string | null,
    payload: SeasonRewindPayload,
    version: number,
    tx: DbTransaction = db,
  ): Promise<string> {
    const [row] = await tx
      .insert(seasonRewinds)
      .values({
        seasonId,
        scope: "season",
        disciplineId,
        payload,
        version,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: seasonRewinds.seasonId,
        targetWhere: eq(seasonRewinds.scope, "season"),
        set: { payload, version, disciplineId, generatedAt: new Date() },
      })
      .returning({ id: seasonRewinds.id });

    return row!.id;
  }

  /**
   * Rewrites the player payloads without touching the per-player state.
   * promotedUntil, openedAt and viewedAt are deliberately excluded from the
   * conflict update: regenerating a rewind (after an MMR recalculation, say)
   * must not restart the promotion window nor un-watch a deck the player has
   * already been through.
   */
  async upsertPlayerRewindsBatch(
    rewindId: string,
    rows: PlayerRewindRow[],
    version: number,
    tx: DbTransaction = db,
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
      await tx
        .insert(playerSeasonRewinds)
        .values(
          chunk.map((row) => ({
            rewindId,
            playerId: row.playerId,
            payload: row.payload,
            version,
            generatedAt: new Date(),
            promotedUntil: row.promotedUntil,
          })),
        )
        .onConflictDoUpdate({
          target: [playerSeasonRewinds.rewindId, playerSeasonRewinds.playerId],
          set: {
            payload: sql`excluded.payload`,
            version: sql`excluded.version`,
            generatedAt: sql`excluded.generated_at`,
          },
        });
    }
  }

  /** Drops player decks that no longer belong to the rewind (players wiped by a recalculation). */
  async deleteStalePlayerRewinds(
    rewindId: string,
    keepPlayerIds: string[],
    tx: DbTransaction = db,
  ): Promise<void> {
    const scope = eq(playerSeasonRewinds.rewindId, rewindId);
    await tx
      .delete(playerSeasonRewinds)
      .where(
        keepPlayerIds.length > 0
          ? and(scope, notInArray(playerSeasonRewinds.playerId, keepPlayerIds))
          : scope,
      );
  }

  async markOpened(seasonId: string, playerId: string): Promise<void> {
    await this.stampOnce(seasonId, playerId, "opened_at");
  }

  async markViewed(seasonId: string, playerId: string): Promise<void> {
    await this.stampOnce(seasonId, playerId, "viewed_at");
  }

  /** Idempotent: the first stamp wins, later calls are no-ops. */
  private async stampOnce(
    seasonId: string,
    playerId: string,
    column: "opened_at" | "viewed_at",
  ): Promise<void> {
    await db.execute(sql`
      UPDATE player_season_rewinds AS p
      SET ${sql.raw(column)} = now()
      FROM season_rewinds AS r
      WHERE p.rewind_id = r.id
        AND r.season_id = ${seasonId}::uuid
        AND r.scope = 'season'
        AND p.player_id = ${playerId}::uuid
        AND p.${sql.raw(column)} IS NULL
    `);
  }

  /** Full archive, newest season first — no promotion window applies here. */
  async listForPlayer(playerId: string): Promise<RewindArchiveEntry[]> {
    const rows = await db
      .select({
        seasonId: tournaments.id,
        seasonName: tournaments.name,
        disciplineName: disciplines.name,
        startDate: tournaments.startDate,
        endDate: tournaments.endDate,
        generatedAt: playerSeasonRewinds.generatedAt,
        viewedAt: playerSeasonRewinds.viewedAt,
      })
      .from(playerSeasonRewinds)
      .innerJoin(seasonRewinds, eq(playerSeasonRewinds.rewindId, seasonRewinds.id))
      .innerJoin(tournaments, eq(seasonRewinds.seasonId, tournaments.id))
      .leftJoin(disciplines, eq(tournaments.disciplineId, disciplines.id))
      .where(eq(playerSeasonRewinds.playerId, playerId))
      .orderBy(desc(tournaments.endDate));

    return rows.map((row) => ({
      seasonId: row.seasonId,
      seasonName: row.seasonName,
      disciplineName: row.disciplineName ?? null,
      startDate: new Date(row.startDate),
      endDate: new Date(row.endDate),
      generatedAt: row.generatedAt,
      viewedAt: row.viewedAt,
    }));
  }

  /**
   * The rewind to put in front of the player right now: still inside its
   * promotion window and not watched to the end. Returns the most recent one so
   * two seasons closing back to back never fight over the home page.
   */
  async getPromotedForPlayer(playerId: string): Promise<RewindPromotion | null> {
    const [row] = await db
      .select({
        seasonId: tournaments.id,
        seasonName: tournaments.name,
        disciplineName: disciplines.name,
        endDate: tournaments.endDate,
        promotedUntil: playerSeasonRewinds.promotedUntil,
        openedAt: playerSeasonRewinds.openedAt,
      })
      .from(playerSeasonRewinds)
      .innerJoin(seasonRewinds, eq(playerSeasonRewinds.rewindId, seasonRewinds.id))
      .innerJoin(tournaments, eq(seasonRewinds.seasonId, tournaments.id))
      .leftJoin(disciplines, eq(tournaments.disciplineId, disciplines.id))
      .where(
        and(
          eq(playerSeasonRewinds.playerId, playerId),
          isNull(playerSeasonRewinds.viewedAt),
          gt(playerSeasonRewinds.promotedUntil, new Date()),
        ),
      )
      .orderBy(desc(playerSeasonRewinds.promotedUntil))
      .limit(1);

    if (!row) return null;
    return {
      seasonId: row.seasonId,
      seasonName: row.seasonName,
      disciplineName: row.disciplineName ?? null,
      endDate: new Date(row.endDate),
      promotedUntil: row.promotedUntil,
      openedAt: row.openedAt,
    };
  }
}

export const seasonRewindRepository = new SeasonRewindRepository();
