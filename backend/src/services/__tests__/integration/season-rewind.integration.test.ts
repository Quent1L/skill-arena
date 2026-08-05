import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { createTestDatabase } from "../../../config/test-database";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../../../db/schema";

// Initialize the test database BEFORE any imports that use `db`.
const testDb: PgliteDatabase<typeof schema> = await createTestDatabase();

import { and, eq, sql } from "drizzle-orm";
import { seasonRewindService } from "../../season-rewind.service";
import { seasonRewindRepository } from "../../../repository/season-rewind.repository";
import {
  appUsers,
  user as betterAuthUser,
  disciplines,
  matches,
  matchSides,
  mmrHistory,
  playerMmr,
  playerSeasonRewinds,
  rankedSeasonConfigs,
  seasonRewinds,
  tournaments,
  tournamentEntries,
  tournamentEntryPlayers,
} from "../../../db/schema";

describe("Season rewind generation (integration)", () => {
  let adminId: string;
  let alice: string;
  let bob: string;
  let seasonId: string;
  let playedAtCursor: number;

  async function createPlayer(name: string) {
    const suffix = `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [authUser] = await testDb
      .insert(betterAuthUser)
      .values({ id: `auth-${suffix}`, name, email: `${suffix}@example.com`, emailVerified: true })
      .returning();
    const [appUser] = await testDb
      .insert(appUsers)
      .values({
        displayName: name,
        shortName: name.slice(0, 3).toUpperCase(),
        externalId: authUser!.id,
        role: "player",
      })
      .returning();
    return appUser!.id;
  }

  async function createSeason(status: "ongoing" | "finished" = "finished") {
    const [season] = await testDb
      .insert(tournaments)
      .values({
        name: `Rewind Season ${Date.now()}-${Math.random().toString(16).slice(2)}`,
        mode: "ranked",
        teamMode: "flex",
        minTeamSize: 1,
        maxTeamSize: 1,
        startDate: "2026-01-01",
        endDate: "2026-06-30",
        status,
        createdBy: adminId,
      })
      .returning();

    await testDb.insert(rankedSeasonConfigs).values({ tournamentId: season!.id });
    return season!.id;
  }

  async function registerPlayer(targetSeasonId: string, playerId: string, mmr: number) {
    await testDb
      .insert(playerMmr)
      .values({ seasonId: targetSeasonId, playerId, currentMmr: mmr })
      .onConflictDoUpdate({
        target: [playerMmr.seasonId, playerMmr.playerId],
        set: { currentMmr: mmr },
      });
  }

  /** One finalized 1v1, with the entries, sides and MMR history a replay needs. */
  async function playMatch(params: {
    winner: string;
    loser: string;
    winnerMmr: [number, number];
    loserMmr: [number, number];
  }) {
    playedAtCursor += 60_000;
    const [match] = await testDb
      .insert(matches)
      .values({
        tournamentId: seasonId,
        status: "finalized",
        winnerSide: "A",
        playedAt: new Date(playedAtCursor),
        createdBy: adminId,
      })
      .returning();

    const sides: [string, number, [number, number], [number, number]][] = [
      [params.winner, 1, params.winnerMmr, params.loserMmr],
      [params.loser, 2, params.loserMmr, params.winnerMmr],
    ];

    for (const [playerId, position, own, opponent] of sides) {
      const [entry] = await testDb
        .insert(tournamentEntries)
        .values({ tournamentId: seasonId, entryType: "PLAYER" })
        .returning();
      await testDb
        .insert(tournamentEntryPlayers)
        .values({ entryId: entry!.id, playerId });
      await testDb
        .insert(matchSides)
        .values({ matchId: match!.id, entryId: entry!.id, position });
      await testDb.insert(mmrHistory).values({
        seasonId,
        playerId,
        matchId: match!.id,
        mmrBefore: own[0],
        mmrAfter: own[1],
        mmrDelta: own[1] - own[0],
        kEffective: 32,
        opponentAvgMmr: opponent[0],
        isPlacement: false,
        outcome: position === 1 ? "win" : "loss",
      });
    }
    return match!.id;
  }

  beforeAll(async () => {
    adminId = await createPlayer("Admin");
  });

  beforeEach(async () => {
    playedAtCursor = Date.UTC(2026, 0, 1);
    alice = await createPlayer("Alice");
    bob = await createPlayer("Bob");
    seasonId = await createSeason();

    await registerPlayer(seasonId, alice, 1100);
    await registerPlayer(seasonId, bob, 900);
    await playMatch({ winner: alice, loser: bob, winnerMmr: [1000, 1050], loserMmr: [1000, 950] });
    await playMatch({ winner: alice, loser: bob, winnerMmr: [1050, 1100], loserMmr: [950, 900] });
  });

  it("stores a global payload and one deck per player", async () => {
    await seasonRewindService.generateForSeason(seasonId);

    const rewind = await seasonRewindRepository.getSeasonRewind(seasonId);
    expect(rewind).not.toBeNull();
    expect(rewind!.payload.totals).toMatchObject({ playerCount: 2, matchCount: 2 });

    const decks = await testDb
      .select()
      .from(playerSeasonRewinds)
      .where(eq(playerSeasonRewinds.rewindId, rewind!.id));
    expect(decks).toHaveLength(2);
  });

  it("builds a player deck from the replayed season", async () => {
    await seasonRewindService.generateForSeason(seasonId);
    const bundle = await seasonRewindService.getBundle(seasonId, alice);

    expect(bundle.player).not.toBeNull();
    expect(bundle.player!.totals).toMatchObject({ matchesPlayed: 2, wins: 2, losses: 0 });
    expect(bundle.player!.journey).toMatchObject({ initialMmr: 1000, finalMmr: 1100, netDelta: 100 });
    expect(bundle.player!.finalRank.rank).toBe(1);
    expect(bundle.player!.streaks.bestWinStreak).toBe(2);
  });

  it("hands the season awards to the players who earned them", async () => {
    await seasonRewindService.generateForSeason(seasonId);
    const bundle = await seasonRewindService.getBundle(seasonId, alice);

    expect(bundle.season.performance.king!.player.playerId).toBe(alice);
    expect(bundle.player!.awardsWon).toContain("king");
  });

  describe("next season", () => {
    async function createDiscipline() {
      const [discipline] = await testDb
        .insert(disciplines)
        .values({ name: `Discipline ${Date.now()}-${Math.random().toString(16).slice(2)}` })
        .returning();
      return discipline!.id;
    }

    it("resolves the next season at read time, not at generation time", async () => {
      const disciplineId = await createDiscipline();
      await testDb
        .update(tournaments)
        .set({ disciplineId })
        .where(eq(tournaments.id, seasonId));

      // Snapshot taken while no follow-up season exists yet — the usual order of
      // events, since a new season is opened after the previous one closes.
      await seasonRewindService.generateForSeason(seasonId);
      let bundle = await seasonRewindService.getBundle(seasonId, alice);
      expect(bundle.player!.conclusion.nextSeason).toBeNull();

      const [next] = await testDb
        .insert(tournaments)
        .values({
          name: `Next Season ${Date.now()}`,
          mode: "ranked",
          teamMode: "flex",
          minTeamSize: 1,
          maxTeamSize: 1,
          startDate: "2026-07-01",
          endDate: "2026-12-31",
          status: "ongoing",
          disciplineId,
          createdBy: adminId,
        })
        .returning();

      // No regeneration: the already stored rewind must pick it up on its own.
      bundle = await seasonRewindService.getBundle(seasonId, alice);
      expect(bundle.player!.conclusion.nextSeason).toMatchObject({
        id: next!.id,
        name: next!.name,
      });
    });

    it("never points a season at itself", async () => {
      const disciplineId = await createDiscipline();
      await testDb
        .update(tournaments)
        .set({ disciplineId, status: "ongoing" })
        .where(eq(tournaments.id, seasonId));
      await testDb
        .update(tournaments)
        .set({ status: "finished" })
        .where(eq(tournaments.id, seasonId));

      await seasonRewindService.generateForSeason(seasonId);
      const bundle = await seasonRewindService.getBundle(seasonId, alice);
      expect(bundle.player!.conclusion.nextSeason).toBeNull();
    });
  });

  it("refuses to generate for a season that is still running", async () => {
    const ongoingId = await createSeason("ongoing");
    await expect(seasonRewindService.generateForSeason(ongoingId)).rejects.toThrow();
  });

  it("reports a missing rewind rather than an empty one", async () => {
    await expect(seasonRewindService.getBundle(seasonId, alice)).rejects.toThrow();
  });

  describe("promotion window", () => {
    async function shiftPromotion(playerId: string, days: number) {
      await testDb
        .update(playerSeasonRewinds)
        .set({ promotedUntil: new Date(Date.now() + days * 24 * 60 * 60 * 1000) })
        .where(eq(playerSeasonRewinds.playerId, playerId));
    }

    beforeEach(async () => {
      await seasonRewindService.generateForSeason(seasonId);
    });

    it("promotes a freshly generated rewind", async () => {
      const promoted = await seasonRewindService.getPromoted(alice);
      expect(promoted).not.toBeNull();
      expect(promoted!.seasonId).toBe(seasonId);
      expect(promoted!.openedAt).toBeNull();
    });

    it("stops promoting once the window has passed", async () => {
      await shiftPromotion(alice, -1);
      expect(await seasonRewindService.getPromoted(alice)).toBeNull();
    });

    it("keeps promoting a rewind that was merely opened", async () => {
      await seasonRewindService.markOpened(seasonId, alice);

      const promoted = await seasonRewindService.getPromoted(alice);
      expect(promoted).not.toBeNull();
      expect(promoted!.openedAt).not.toBeNull();
    });

    it("stops promoting once the deck has been watched to the end", async () => {
      await seasonRewindService.markViewed(seasonId, alice);
      expect(await seasonRewindService.getPromoted(alice)).toBeNull();
    });

    it("keeps the first opened_at stamp on repeated opens", async () => {
      await seasonRewindService.markOpened(seasonId, alice);
      const first = (await seasonRewindService.getPromoted(alice))!.openedAt;

      await seasonRewindService.markOpened(seasonId, alice);
      const second = (await seasonRewindService.getPromoted(alice))!.openedAt;
      expect(second).toEqual(first);
    });
  });

  describe("regeneration", () => {
    beforeEach(async () => {
      await seasonRewindService.generateForSeason(seasonId);
    });

    it("preserves the promotion window, opened and viewed stamps", async () => {
      await seasonRewindService.markOpened(seasonId, alice);
      await seasonRewindService.markViewed(seasonId, alice);

      const before = await seasonRewindRepository.getPlayerRewind(seasonId, alice);
      await seasonRewindService.generateForSeason(seasonId);
      const after = await seasonRewindRepository.getPlayerRewind(seasonId, alice);

      expect(after!.promotedUntil).toEqual(before!.promotedUntil);
      expect(after!.openedAt).toEqual(before!.openedAt);
      expect(after!.viewedAt).toEqual(before!.viewedAt);
    });

    it("does not resurrect the promo card for a player who already watched it", async () => {
      await seasonRewindService.markViewed(seasonId, alice);
      await seasonRewindService.generateForSeason(seasonId);

      expect(await seasonRewindService.getPromoted(alice)).toBeNull();
    });

    it("refreshes the payload and reuses the same rewind row", async () => {
      const first = await seasonRewindRepository.getSeasonRewind(seasonId);
      await playMatch({ winner: bob, loser: alice, winnerMmr: [900, 950], loserMmr: [1100, 1050] });
      await seasonRewindService.generateForSeason(seasonId);

      const second = await seasonRewindRepository.getSeasonRewind(seasonId);
      expect(second!.id).toBe(first!.id);
      expect(second!.payload.totals.matchCount).toBe(3);
    });

    it("keeps exactly one rewind row per season", async () => {
      await seasonRewindService.generateForSeason(seasonId);

      const rows = await testDb
        .select({ count: sql<number>`count(*)::int` })
        .from(seasonRewinds)
        .where(and(eq(seasonRewinds.seasonId, seasonId), eq(seasonRewinds.scope, "season")));
      expect(rows[0]!.count).toBe(1);
    });
  });

  describe("archive", () => {
    it("lists the player's rewinds with their viewed state", async () => {
      await seasonRewindService.generateForSeason(seasonId);

      let archive = await seasonRewindService.listArchive(alice);
      expect(archive).toHaveLength(1);
      expect(archive[0]!.seasonId).toBe(seasonId);
      expect(archive[0]!.viewedAt).toBeNull();

      await seasonRewindService.markViewed(seasonId, alice);
      archive = await seasonRewindService.listArchive(alice);
      expect(archive[0]!.viewedAt).not.toBeNull();
    });

    it("still lists a rewind whose promotion window has expired", async () => {
      await seasonRewindService.generateForSeason(seasonId);
      await testDb
        .update(playerSeasonRewinds)
        .set({ promotedUntil: new Date(Date.now() - 1000) })
        .where(eq(playerSeasonRewinds.playerId, alice));

      expect(await seasonRewindService.getPromoted(alice)).toBeNull();
      expect(await seasonRewindService.listArchive(alice)).toHaveLength(1);
    });
  });
});
