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
  disciplines,
  outcomeTypes,
  outcomeReasons,
} from "../../../db/schema";
import type { RuleConditions } from "@skol-arena/shared";
import { eq } from "drizzle-orm";

const NAMES = ["Alice", "Bob", "Carl", "Dana"] as const;

describe("Rules engine — line-up facts & random gating (integration)", () => {
  let adminId: string;
  let tournamentId: string;
  let matchId: string;
  /** Same line-up, but submitted with a non-default outcome type and its reason. */
  let forfeitMatchId: string;
  let forfeitTypeId: string;
  let forfeitReasonId: string;
  /** A match whose tournament DOES carry a discipline, unlike the one above. */
  let disciplineMatchId: string;
  let disciplineId: string;
  /** 2 v 1, scores at 0, in the discipline-bearing tournament. */
  let unevenMatchId: string;
  /** Match in the discipline-bearing tournament, carrying an outcome type. */
  let disciplineOutcomeMatchId: string;
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
  async function createMatch(
    outcome?: { outcomeTypeId: string; outcomeReasonId: string },
    inTournament?: string,
  ): Promise<string> {
    const target = inTournament ?? tournamentId;
    const [match] = await testDb
      .insert(matches)
      .values({
        tournamentId: target,
        status: "finalized",
        winnerSide: "A",
        playedAt: new Date(),
        createdBy: adminId,
        ...outcome,
      })
      .returning();

    for (const [index, side] of [playerIds.slice(0, 2), playerIds.slice(2)].entries()) {
      const [entry] = await testDb
        .insert(tournamentEntries)
        .values({ tournamentId: target, entryType: "PLAYER" })
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

    const [discipline] = await testDb.insert(disciplines).values({ name: `Discipline ${Date.now()}` }).returning();
    const [forfeitType] = await testDb
      .insert(outcomeTypes)
      .values({ disciplineId: discipline.id, name: "Forfeit", isDefault: false })
      .returning();
    const [injury] = await testDb
      .insert(outcomeReasons)
      .values({ outcomeTypeId: forfeitType.id, name: "Injury" })
      .returning();
    forfeitTypeId = forfeitType.id;
    forfeitReasonId = injury.id;
    forfeitMatchId = await createMatch({ outcomeTypeId: forfeitTypeId, outcomeReasonId: forfeitReasonId });

    // The tournament above carries no discipline, so rule lookup never exercises the
    // "global OR this discipline" branch. This second one does.
    disciplineId = discipline.id;
    const [disciplineTournament] = await testDb
      .insert(tournaments)
      .values({
        name: `Rules engine discipline tournament ${Date.now()}`,
        mode: "championship",
        teamMode: "flex",
        minTeamSize: 2,
        maxTeamSize: 2,
        startDate: today,
        endDate: nextWeek,
        status: "ongoing",
        disciplineId: discipline.id,
        createdBy: adminId,
      })
      .returning();
    disciplineMatchId = await createMatch(undefined, disciplineTournament.id);
    disciplineOutcomeMatchId = await createMatch(
      { outcomeTypeId: forfeitTypeId, outcomeReasonId: forfeitReasonId },
      disciplineTournament.id,
    );

    // Faithful copy of a reported failure: uneven sides (2 v 1) in a flex tournament
    // that carries a discipline, scores disabled so both sides sit at 0.
    const [unevenMatch] = await testDb
      .insert(matches)
      .values({
        tournamentId: disciplineTournament.id,
        status: "finalized",
        winnerSide: "A",
        playedAt: new Date(),
        createdBy: adminId,
      })
      .returning();
    for (const [index, side] of [playerIds.slice(0, 2), playerIds.slice(2, 3)].entries()) {
      const [entry] = await testDb
        .insert(tournamentEntries)
        .values({ tournamentId: disciplineTournament.id, entryType: "PLAYER" })
        .returning();
      await testDb.insert(tournamentEntryPlayers).values(side.map((playerId) => ({ entryId: entry.id, playerId })));
      await testDb
        .insert(matchSides)
        .values({ matchId: unevenMatch.id, entryId: entry.id, position: index + 1, score: 0 });
    }
    unevenMatchId = unevenMatch.id;
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

      expect(context.winnerIds).toContain(alice);
      expect(context.scoreWinner).toBe(5);
      expect(context.scoreLoser).toBe(2);
      expect(context.matchScore).toBe("5-2");
    });

    it("exposes the declared outcome to every player of the match", async () => {
      const { contexts } = await rulesContextService.buildMatchSubmittedContexts(forfeitMatchId);

      expect(contexts).toHaveLength(4);
      // A match-level fact: identical on both sides, winners and losers alike.
      for (const { context } of contexts) {
        expect(context).toMatchObject({
          outcomeType: forfeitTypeId,
          outcomeTypeName: "Forfeit",
          isDefaultOutcome: false,
          outcomeReason: forfeitReasonId,
          outcomeReasonName: "Injury",
        });
      }
    });

    it("exposes the full winning and losing line-ups, not just their first player", async () => {
      const { contexts } = await rulesContextService.buildMatchSubmittedContexts(matchId);
      const [alice, bob, carl, dana] = playerIds;
      const byPlayer = new Map(contexts.map((c) => [c.playerId, c.context]));

      for (const { context } of contexts) {
        expect(context.winnerIds).toEqual([alice, bob]);
        expect(context.loserIds).toEqual([carl, dana]);
      }
      expect(byPlayer.get(alice)!.isWinner).toBe(true);
      expect(byPlayer.get(bob)!.isWinner).toBe(true);
      expect(byPlayer.get(carl)!.isWinner).toBe(false);
      expect(byPlayer.get(dana)!.isWinner).toBe(false);
    });

    it("falls back to empty outcome facts when the match was submitted without one", async () => {
      const { contexts } = await rulesContextService.buildMatchSubmittedContexts(matchId);
      const context = contexts[0].context;

      expect(context).toMatchObject({
        outcomeType: "",
        outcomeTypeName: "",
        isDefaultOutcome: false,
        outcomeReason: "",
        outcomeReasonName: "",
      });
    });
  });

  describe("evaluateMatchSubmitted", () => {
    it("awards a badge on a non-default outcome, and skips the match that has none", async () => {
      const [rule] = await testDb
        .insert(rules)
        .values({
          triggerEvent: "match_submitted",
          type: "badge",
          scope: "global",
          priority: 0,
          name: "No mercy",
          conditions: {
            all: [
              { fact: "outcomeTypeName", operator: "equal", value: "Forfeit" },
              { fact: "outcomeReasonName", operator: "equal", value: "Injury" },
            ],
          },
          action: { type: "badge", icon: "fa fa-ban", label: "No mercy", description: "Won by forfeit" },
          isActive: true,
          createdBy: adminId,
        })
        .returning();

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(forfeitMatchId);

      // The outcome is a match-level fact, so all four players earn it.
      expect([...outputs.keys()].sort()).toEqual([...playerIds].sort());
      expect(outputs.get(playerIds[0])?.badges).toMatchObject([{ ruleId: rule.id, label: "No mercy" }]);

      // Same rule, same line-up, but that match carries no outcome type.
      expect((await rulesEvaluationService.evaluateMatchSubmitted(matchId)).size).toBe(0);
    });

    it("fires a 'this team won' rule for both members of the winning pair", async () => {
      const [alice, bob] = playerIds;
      await addMessageRule(
        "Exact winning pair",
        {
          all: [
            { fact: "winnerIds", operator: "containsExactly", value: [alice, bob] },
            { fact: "isWinner", operator: "equal", value: true },
          ],
        },
        ["Blue team wins!"],
      );

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);

      // The two winners, and nobody else — the losers share winnerIds but not isWinner.
      expect([...outputs.keys()].sort()).toEqual([alice, bob].sort());
      expect(outputs.get(bob)?.message).toBe("Blue team wins!");
    });

    it("does not fire that rule when the winning side is not exactly that pair", async () => {
      const [alice, , carl] = playerIds;
      await addMessageRule(
        "Other pair",
        { all: [{ fact: "winnerIds", operator: "containsExactly", value: [alice, carl] }] },
        ["Never"],
      );

      expect((await rulesEvaluationService.evaluateMatchSubmitted(matchId)).size).toBe(0);
    });

    it("still applies a global rule on a match whose tournament has a discipline", async () => {
      const [alice] = playerIds;
      await addMessageRule("Global rule", { all: [{ fact: "playerId", operator: "equal", value: alice }] }, ["Global rule"]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(disciplineMatchId);

      expect(outputs.get(alice)?.message).toBe("Global rule");
    });

    it("applies a discipline-scoped rule to its own discipline only", async () => {
      const [alice] = playerIds;
      await testDb.insert(rules).values({
        triggerEvent: "match_submitted",
        type: "message",
        scope: "discipline",
        disciplineId,
        priority: 0,
        name: "Discipline rule",
        conditions: { all: [{ fact: "playerId", operator: "equal", value: alice }] },
        action: { type: "message", variants: ["Discipline rule"] },
        isActive: true,
        createdBy: adminId,
      });

      expect((await rulesEvaluationService.evaluateMatchSubmitted(disciplineMatchId)).get(alice)?.message).toBe(
        "Discipline rule",
      );
      // The other tournament has no discipline, so the rule must not reach it.
      expect((await rulesEvaluationService.evaluateMatchSubmitted(matchId)).size).toBe(0);
    });

    it("fires a global containsExactly rule on a 2 v 1 scoreless match", async () => {
      const [alice, bob] = playerIds;
      await addMessageRule("Exact pair", { all: [{ fact: "winnerIds", operator: "containsExactly", value: [alice, bob] }] }, [
        "Blue team wins!",
      ]);

      const { contexts } = await rulesContextService.buildMatchSubmittedContexts(unevenMatchId);
      expect(contexts.map((c) => c.context.winnerIds)).toEqual([[alice, bob], [alice, bob], [alice, bob]]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(unevenMatchId);
      expect(outputs.get(alice)?.message).toBe("Blue team wins!");
    });

    it("fires a discipline-scoped rule matching an outcome type by id", async () => {
      const [alice] = playerIds;
      await testDb.insert(rules).values({
        triggerEvent: "match_submitted",
        type: "message",
        scope: "discipline",
        disciplineId,
        priority: 0,
        name: "Match ended",
        conditions: { all: [{ fact: "outcomeType", operator: "equal", value: forfeitTypeId }] },
        action: { type: "message", variants: ["Result recorded"] },
        isActive: true,
        createdBy: adminId,
      });

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(disciplineOutcomeMatchId);
      expect(outputs.get(alice)?.message).toBe("Result recorded");
    });

    it("never reaches a discipline-scoped rule when the tournament carries no discipline", async () => {
      const [alice] = playerIds;
      await testDb.insert(rules).values({
        triggerEvent: "match_submitted",
        type: "message",
        scope: "discipline",
        disciplineId,
        priority: 0,
        name: "Match ended",
        conditions: { all: [{ fact: "outcomeType", operator: "equal", value: forfeitTypeId }] },
        action: { type: "message", variants: ["Result recorded"] },
        isActive: true,
        createdBy: adminId,
      });

      // Same rule, same outcome type on the match — but this tournament has no
      // discipline, so the scope filter drops the rule before it is ever evaluated.
      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(forfeitMatchId);
      expect(outputs.get(alice)).toBeUndefined();
    });

    it("delivers the message only to the targeted player", async () => {
      const [alice] = playerIds;
      await addMessageRule("For Alice", { all: [{ fact: "playerId", operator: "equal", value: alice }] }, [
        "Message reserved for {{playerId}}",
      ]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);

      expect([...outputs.keys()]).toEqual([alice]);
      expect(outputs.get(alice)?.message).toBe("Message reserved for Alice");
    });

    it("matches 'teammate of X' for the partner only, not for X themselves", async () => {
      const [alice, bob] = playerIds;
      await addMessageRule("Duo with Bob", { all: [{ fact: "teammateIds", operator: "contains", value: bob }] }, [
        "{{playerId}} duo with {{teammateIds}} against {{opponentIds}}",
      ]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);

      // Only Alice has Bob as a teammate; Bob's own teammate list holds Alice.
      expect([...outputs.keys()]).toEqual([alice]);
      expect(outputs.get(alice)?.message).toBe("Alice duo with Bob against Carl, Dana");
    });

    it("matches 'against X' through opponentIds", async () => {
      const [alice, bob, carl] = playerIds;
      await addMessageRule("Against Carl", { all: [{ fact: "opponentIds", operator: "contains", value: carl }] }, [
        "Opponents: {{opponentIds}}",
      ]);

      const outputs = await rulesEvaluationService.evaluateMatchSubmitted(matchId);

      expect(new Set(outputs.keys())).toEqual(new Set([alice, bob]));
      expect(outputs.get(alice)?.message).toBe("Opponents: Carl, Dana");
    });

    it("always fires when randomRoll is below the threshold, never when above", async () => {
      await addMessageRule("Always", { all: [{ fact: "randomRoll", operator: "lessThan", value: 100 }] }, ["ok"]);
      const always = await rulesEvaluationService.evaluateMatchSubmitted(matchId);
      expect(always.size).toBe(4);

      await testDb.delete(rules).where(eq(rules.createdBy, adminId));
      await addMessageRule("Never", { all: [{ fact: "randomRoll", operator: "lessThan", value: 0 }] }, ["ko"]);
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
