import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { createTestDatabase, closeTestDatabase } from "../../../config/test-database";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../../../db/schema";

// Initialize the test database BEFORE any imports that use `db`.
const testDb: PgliteDatabase<typeof schema> = await createTestDatabase();

import { rulesContextService } from "../../rules-context.service";
import { rulesEvaluationService } from "../../rules-evaluation.service";
import {
  tournaments,
  appUsers,
  user as betterAuthUser,
  tournamentEntries,
  tournamentEntryPlayers,
  matches,
  matchSides,
  rules,
} from "../../../db/schema";
import type { RuleConditions } from "@skol-arena/shared";
import { eq } from "drizzle-orm";

const NAMES = ["Alice", "Bob", "Carl", "Dana"] as const;

describe("Rules engine — line-up facts & random gating (integration)", () => {
  let adminId: string;
  let tournamentId: string;
  let matchId: string;
  /** Alice, Bob (side A) then Carl, Dana (side B). */
  let playerIds: string[];

  async function createPlayer(name: string, role: "super_admin" | "player" = "player") {
    const suffix = `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [authUser] = await testDb
      .insert(betterAuthUser)
      .values({ id: `auth-${suffix}`, name, email: `${suffix}@example.com`, emailVerified: true })
      .returning();
    const [appUser] = await testDb
      .insert(appUsers)
      .values({ displayName: name, shortName: name.slice(0, 3).toUpperCase(), externalId: authUser.id, role })
      .returning();
    return appUser.id;
  }

  /** Creates a finalized 2v2 match: [Alice, Bob] 5 - 2 [Carl, Dana]. */
  async function createMatch(): Promise<string> {
    const [match] = await testDb
      .insert(matches)
      .values({ tournamentId, status: "finalized", winnerSide: "A", playedAt: new Date(), createdBy: adminId })
      .returning();

    for (const [index, side] of [playerIds.slice(0, 2), playerIds.slice(2)].entries()) {
      const [entry] = await testDb
        .insert(tournamentEntries)
        .values({ tournamentId, entryType: "PLAYER" })
        .returning();
      await testDb.insert(tournamentEntryPlayers).values(side.map((playerId) => ({ entryId: entry.id, playerId })));
      await testDb
        .insert(matchSides)
        .values({ matchId: match.id, entryId: entry.id, position: index + 1, score: index === 0 ? 5 : 2 });
    }
    return match.id;
  }

  async function addMessageRule(name: string, conditions: RuleConditions, variants: string[], priority = 0) {
    const [rule] = await testDb
      .insert(rules)
      .values({
        triggerEvent: "match_submitted",
        type: "message",
        scope: "global",
        priority,
        name,
        conditions,
        action: { type: "message", variants },
        isActive: true,
        createdBy: adminId,
      })
      .returning();
    return rule.id;
  }

  beforeAll(async () => {
    adminId = await createPlayer("Admin", "super_admin");
    playerIds = [];
    for (const name of NAMES) playerIds.push(await createPlayer(name));

    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];
    const [tournament] = await testDb
      .insert(tournaments)
      .values({
        name: `Rules engine tournament ${Date.now()}`,
        mode: "championship",
        teamMode: "flex",
        minTeamSize: 2,
        maxTeamSize: 2,
        startDate: today,
        endDate: nextWeek,
        status: "ongoing",
        createdBy: adminId,
      })
      .returning();
    tournamentId = tournament.id;
    matchId = await createMatch();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  afterEach(async () => {
    await testDb.delete(rules).where(eq(rules.createdBy, adminId));
  });

  describe("buildMatchSubmittedContexts", () => {
    it("exposes the evaluated player, their teammates and their opponents", async () => {
      const { contexts, displayNames } = await rulesContextService.buildMatchSubmittedContexts(matchId);
      const [alice, bob, carl, dana] = playerIds;

      expect(contexts).toHaveLength(4);
      const byPlayer = new Map(contexts.map((c) => [c.playerId, c.context]));

      expect(byPlayer.get(alice)).toMatchObject({
        playerId: alice,
        teammateIds: [bob],
        opponentIds: [carl, dana],
      });
      expect(byPlayer.get(dana)).toMatchObject({
        playerId: dana,
        teammateIds: [carl],
        opponentIds: [alice, bob],
      });
      // The evaluated player is never listed among their own teammates.
      for (const { playerId, context } of contexts) {
        expect(context.teammateIds).not.toContain(playerId);
        expect(context.opponentIds).not.toContain(playerId);
      }
      expect(displayNames.get(alice)).toBe("Alice");
    });

    it("keeps winner/loser facts alongside the new line-up facts", async () => {
      const { contexts } = await rulesContextService.buildMatchSubmittedContexts(matchId);
      const [alice] = playerIds;
      const context = contexts.find((c) => c.playerId === alice)!.context;

      expect(context.winnerId).toBe(alice);
      expect(context.scoreWinner).toBe(5);
      expect(context.scoreLoser).toBe(2);
      expect(context.matchScore).toBe("5-2");
    });
  });

  describe("evaluateMatchSubmitted", () => {
    it("delivers the message only to the targeted player", async () => {
      const [alice] = playerIds;
      await addMessageRule("Pour Alice", { all: [{ fact: "playerId", operator: "equal", value: alice }] }, [
        "Message réservé à {{playerId}}",
      ]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);

      expect([...outputs.keys()]).toEqual([alice]);
      expect(outputs.get(alice)?.message).toBe("Message réservé à Alice");
    });

    it("matches 'teammate of X' for the partner only, not for X themselves", async () => {
      const [alice, bob] = playerIds;
      await addMessageRule("Duo avec Bob", { all: [{ fact: "teammateIds", operator: "contains", value: bob }] }, [
        "{{playerId}} en duo avec {{teammateIds}} contre {{opponentIds}}",
      ]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);

      // Only Alice has Bob as a teammate; Bob's own teammate list holds Alice.
      expect([...outputs.keys()]).toEqual([alice]);
      expect(outputs.get(alice)?.message).toBe("Alice en duo avec Bob contre Carl, Dana");
    });

    it("matches 'against X' through opponentIds", async () => {
      const [alice, bob, carl] = playerIds;
      await addMessageRule("Contre Carl", { all: [{ fact: "opponentIds", operator: "contains", value: carl }] }, [
        "Adversaires : {{opponentIds}}",
      ]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);

      expect(new Set(outputs.keys())).toEqual(new Set([alice, bob]));
      expect(outputs.get(alice)?.message).toBe("Adversaires : Carl, Dana");
    });

    it("always fires when randomRoll is below the threshold, never when above", async () => {
      await addMessageRule("Toujours", { all: [{ fact: "randomRoll", operator: "lessThan", value: 100 }] }, ["ok"]);
      const always = await rulesEvaluationService.evaluateMatchSubmitted(matchId);
      expect(always.size).toBe(4);

      await testDb.delete(rules).where(eq(rules.createdBy, adminId));
      await addMessageRule("Jamais", { all: [{ fact: "randomRoll", operator: "lessThan", value: 0 }] }, ["ko"]);
      const never = await rulesEvaluationService.evaluateMatchSubmitted(matchId);
      expect(never.size).toBe(0);
    });

    it("re-draws randomRoll on every evaluation so base messages still get their turn", async () => {
      await addMessageRule("Une fois sur deux", { all: [{ fact: "randomRoll", operator: "lessThan", value: 50 }] }, [
        "custom",
      ]);

      const [alice] = playerIds;
      let hits = 0;
      const runs = 60;
      for (let i = 0; i < runs; i++) {
        const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);
        if (outputs.get(alice)?.message) hits++;
      }

      // Binomial(60, 0.5): the [10, 50] window is ~1 - 1e-8 likely, so this is
      // stable while still catching a roll that never (or always) fires.
      expect(hits).toBeGreaterThan(10);
      expect(hits).toBeLessThan(50);
    });

    it("lets a lower-priority rule win when the gated rule loses its roll", async () => {
      await addMessageRule("Rare", { all: [{ fact: "randomRoll", operator: "lessThan", value: 0 }] }, ["rare"], 10);
      await addMessageRule("Repli", { all: [{ fact: "scoreWinner", operator: "greaterThan", value: 0 }] }, ["repli"]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);

      expect(outputs.size).toBe(4);
      for (const output of outputs.values()) expect(output.message).toBe("repli");
    });
  });
});
