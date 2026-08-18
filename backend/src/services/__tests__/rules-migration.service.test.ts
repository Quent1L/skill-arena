import { describe, it, expect } from "bun:test";
import { RULES_ENGINE_VERSION, type RuleAction, type RuleConditions } from "@skol-arena/shared";
import { migrateRule, RULE_PATCHES, type MigratableRule } from "../rules-migration.service";

const message = (...variants: string[]): RuleAction => ({ type: "message", variants });
const badge: RuleAction = { type: "badge", icon: "fa fa-fire", label: "X", description: "Y" };

function v1(conditions: RuleConditions, action: RuleAction = message("ok")): MigratableRule {
  return { conditions, action };
}

describe("RULE_PATCHES", () => {
  it("is ordered and lands exactly on the declared engine version", () => {
    const targets = RULE_PATCHES.map((p) => p.to);
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
    expect(Math.max(...targets)).toBe(RULES_ENGINE_VERSION);
  });
});

describe("migrateRule — v1 → v2 (line-ups)", () => {
  it("rewrites each scalar operator to its line-up equivalent", () => {
    const cases: [string, string][] = [
      ["equal", "contains"],
      ["notEqual", "doesNotContain"],
      ["in", "containsAny"],
      ["notIn", "containsNone"],
    ];

    for (const [from, to] of cases) {
      const out = migrateRule(v1({ all: [{ fact: "winnerId", operator: from, value: "p1" }] }), 1);
      expect(out.disabled).toBeUndefined();
      expect(out.version).toBe(2);
      expect(out.rule.conditions).toEqual({ all: [{ fact: "winnerIds", operator: to, value: "p1" }] });
    }
  });

  it("renames loserId as well, and keeps the value untouched", () => {
    const out = migrateRule(v1({ all: [{ fact: "loserId", operator: "in", value: ["a", "b"] }] }), 1);
    expect(out.rule.conditions).toEqual({ all: [{ fact: "loserIds", operator: "containsAny", value: ["a", "b"] }] });
  });

  it("recurses through nested any/all groups and leaves other facts alone", () => {
    const out = migrateRule(
      v1({
        all: [
          { fact: "winnerId", operator: "equal", value: "p1" },
          { any: [{ fact: "winStreak", operator: "greaterThan", value: 3 }, { fact: "loserId", operator: "equal", value: "p2" }] },
        ],
      }),
      1,
    );

    expect(out.rule.conditions).toEqual({
      all: [
        { fact: "winnerIds", operator: "contains", value: "p1" },
        {
          any: [
            { fact: "winStreak", operator: "greaterThan", value: 3 },
            { fact: "loserIds", operator: "contains", value: "p2" },
          ],
        },
      ],
    });
  });

  it("rewrites the message variables too", () => {
    const out = migrateRule(
      v1({ all: [{ fact: "winStreak", operator: "equal", value: 1 }] }, message("{{winnerId}} bat {{ loserId }}")),
      1,
    );
    expect(out.rule.action).toEqual(message("{{winnerIds}} bat {{loserIds}}"));
  });

  it("leaves a badge action untouched", () => {
    const out = migrateRule(v1({ all: [{ fact: "winnerId", operator: "equal", value: "p1" }] }, badge), 1);
    expect(out.rule.action).toEqual(badge);
  });

  it("gives up on substring operators, which have no line-up equivalent", () => {
    const out = migrateRule(v1({ all: [{ fact: "winnerId", operator: "contains", value: "abc" }] }), 1);
    expect(out.disabled).toContain("no line-up equivalent");
    // Left at its old version so a later patch, or a human, can still handle it.
    expect(out.version).toBe(1);
    expect(out.rule.conditions).toEqual({ all: [{ fact: "winnerId", operator: "contains", value: "abc" }] });
  });

  it("is a no-op on a rule already at the current version", () => {
    const current = v1({ all: [{ fact: "winnerIds", operator: "contains", value: "p1" }] });
    const out = migrateRule(current, RULES_ENGINE_VERSION);
    expect(out.rule).toEqual(current);
    expect(out.version).toBe(RULES_ENGINE_VERSION);
  });

  it("is idempotent: re-running from the produced version changes nothing", () => {
    const first = migrateRule(v1({ all: [{ fact: "winnerId", operator: "equal", value: "p1" }] }), 1);
    const second = migrateRule(first.rule, first.version);
    expect(second.rule).toEqual(first.rule);
    expect(second.version).toBe(first.version);
  });

  it("reproduces a real-world rule that used both retired facts", () => {
    const out = migrateRule(
      v1({
        all: [
          { fact: "winnerId", operator: "in", value: ["fd9a2b7e"] },
          { fact: "loserId", operator: "in", value: ["728be391"] },
        ],
      }),
      1,
    );

    expect(out.disabled).toBeUndefined();
    expect(out.rule.conditions).toEqual({
      all: [
        { fact: "winnerIds", operator: "containsAny", value: ["fd9a2b7e"] },
        { fact: "loserIds", operator: "containsAny", value: ["728be391"] },
      ],
    });
  });
});
