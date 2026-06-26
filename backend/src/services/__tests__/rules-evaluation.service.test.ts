import { describe, it, expect } from "bun:test";
import { rulesEvaluationService, interpolate } from "../rules-evaluation.service";
import type { BadgeAction, MessageAction, RuleConditions } from "@skol-arena/shared";

describe("interpolate", () => {
  it("replaces {{var}} placeholders with context values", () => {
    expect(interpolate("Tu gagnes {{mmrDelta}} MMR", { mmrDelta: 18 })).toBe("Tu gagnes 18 MMR");
  });

  it("handles spacing inside braces and multiple variables", () => {
    expect(interpolate("{{ winStreak }} victoires pour {{name}}", { winStreak: 3, name: "Bob" })).toBe(
      "3 victoires pour Bob",
    );
  });

  it("replaces unknown/undefined variables with empty string", () => {
    expect(interpolate("a{{missing}}b", {})).toBe("ab");
  });
});

describe("RulesEvaluationService.simulate", () => {
  const winStreak3: RuleConditions = { all: [{ fact: "winStreak", operator: "greaterThanInclusive", value: 3 }] };
  const messageAction: MessageAction = { type: "message", variants: ["Série de {{winStreak}} !"] };
  const badgeAction: BadgeAction = { type: "badge", icon: "fa fa-fire", label: "Inarrêtable", description: "5 wins" };

  it("returns matched=true and interpolated message when conditions pass", async () => {
    const result = await rulesEvaluationService.simulate(winStreak3, messageAction, { winStreak: 5 });
    expect(result.matched).toBe(true);
    expect(result.output).toEqual({ type: "message", message: "Série de 5 !" });
  });

  it("returns matched=false when conditions fail", async () => {
    const result = await rulesEvaluationService.simulate(winStreak3, messageAction, { winStreak: 1 });
    expect(result.matched).toBe(false);
    expect(result.output).toBeUndefined();
  });

  it("returns a badge output when a badge rule matches", async () => {
    const result = await rulesEvaluationService.simulate(winStreak3, badgeAction, { winStreak: 5 });
    expect(result.matched).toBe(true);
    expect(result.output).toEqual({
      type: "badge",
      badge: { ruleId: "test", icon: "fa fa-fire", label: "Inarrêtable", description: "5 wins" },
    });
  });

  it("supports nested any/all groups", async () => {
    const conditions: RuleConditions = {
      any: [
        { fact: "rankUp", operator: "equal", value: true },
        { all: [{ fact: "mmrDelta", operator: "greaterThan", value: 30 }] },
      ],
    };
    const matched = await rulesEvaluationService.simulate(conditions, messageAction, { rankUp: false, mmrDelta: 40 });
    expect(matched.matched).toBe(true);

    const notMatched = await rulesEvaluationService.simulate(conditions, messageAction, {
      rankUp: false,
      mmrDelta: 10,
    });
    expect(notMatched.matched).toBe(false);
  });

  it("treats undefined facts as non-matching (allowUndefinedFacts)", async () => {
    const result = await rulesEvaluationService.simulate(winStreak3, messageAction, {});
    expect(result.matched).toBe(false);
  });

  it("matches a match-hour time window (e.g. night match 2h-4h)", async () => {
    const nightWindow: RuleConditions = {
      all: [
        { fact: "matchHour", operator: "greaterThanInclusive", value: 2 },
        { fact: "matchHour", operator: "lessThanInclusive", value: 4 },
      ],
    };
    const badge: BadgeAction = { type: "badge", icon: "fa fa-moon", label: "Couche-tard", description: "Match nocturne" };

    expect((await rulesEvaluationService.simulate(nightWindow, badge, { matchHour: 3 })).matched).toBe(true);
    expect((await rulesEvaluationService.simulate(nightWindow, badge, { matchHour: 12 })).matched).toBe(false);
  });

  it("matches a minute-precise time window (02:30 → 04:15 via matchMinuteOfDay)", async () => {
    const window: RuleConditions = {
      all: [
        { fact: "matchMinuteOfDay", operator: "greaterThanInclusive", value: 150 }, // 02:30
        { fact: "matchMinuteOfDay", operator: "lessThanInclusive", value: 255 }, // 04:15
      ],
    };
    expect((await rulesEvaluationService.simulate(window, messageAction, { matchMinuteOfDay: 200 })).matched).toBe(true);
    expect((await rulesEvaluationService.simulate(window, messageAction, { matchMinuteOfDay: 149 })).matched).toBe(false);
  });

  it("matches weekend days via matchDayOfWeek in [6,7]", async () => {
    const weekend: RuleConditions = { all: [{ fact: "matchDayOfWeek", operator: "in", value: [6, 7] }] };
    expect((await rulesEvaluationService.simulate(weekend, messageAction, { matchDayOfWeek: 7 })).matched).toBe(true);
    expect((await rulesEvaluationService.simulate(weekend, messageAction, { matchDayOfWeek: 3 })).matched).toBe(false);
  });
});
