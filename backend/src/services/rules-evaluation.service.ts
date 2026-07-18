import { Engine } from "json-rules-engine";
import { rulesRepository } from "../repository/rules.repository";
import { rulesContextService } from "./rules-context.service";
import { logger } from "../utils/logger";
import {
  EVENT_FACT_CATALOG,
  type BadgeAction,
  type MatchSubmittedContext,
  type MessageAction,
  type PlayerRulesOutput,
  type RuleAction,
  type RuleConditions,
  type TestRuleResult,
} from "@skol-arena/shared";

type Facts = Record<string, unknown>;

interface EvaluableRule {
  id: string;
  type: "message" | "badge";
  priority: number;
  action: RuleAction;
  conditions: RuleConditions;
}

/**
 * Replaces {{key}} variables in a template with values from the context.
 */
export function interpolate(template: string, facts: Facts): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = facts[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/**
 * Selects the winning rule: highest priority, random draw
 * on tie.
 */
function selectWinner<T extends { priority: number }>(candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  const maxPriority = Math.max(...candidates.map((c) => c.priority));
  const top = candidates.filter((c) => c.priority === maxPriority);
  return top[Math.floor(Math.random() * top.length)];
}

function pickVariant(action: MessageAction): string {
  return action.variants[Math.floor(Math.random() * action.variants.length)];
}

const PLAYER_FACT_KEYS = EVENT_FACT_CATALOG.match_submitted.filter((f) => f.ref === "player").map((f) => f.key);

/**
 * For message interpolation, player-reference facts (winnerId/loserId) render
 * the player's displayName instead of the raw UUID.
 */
function resolveDisplay(facts: Facts, displayNames: Map<string, string>): Facts {
  if (displayNames.size === 0) return facts;
  const out: Facts = { ...facts };
  for (const key of PLAYER_FACT_KEYS) {
    const id = facts[key];
    if (typeof id === "string" && displayNames.has(id)) out[key] = displayNames.get(id);
  }
  return out;
}

export class RulesEvaluationService {
  /**
   * Evaluates `match_submitted` rules for a finalized match (one pass per
   * player). Assigns badges (uniqueness) and returns, per player, the message
   * and badge produced. Broadcasting (message injected into the MMR animation,
   * animated badge) is handled by mmr-animation-event.service.
   */
  async evaluateMatchSubmitted(matchId: string): Promise<Map<string, PlayerRulesOutput>> {
    const result = new Map<string, PlayerRulesOutput>();
    const { contexts, displayNames } = await rulesContextService.buildMatchSubmittedContexts(matchId);
    if (contexts.length === 0) return result;

    const disciplineId = contexts[0].context.discipline || null;
    const rules = await rulesRepository.listActiveByTrigger("match_submitted", disciplineId);
    if (rules.length === 0) return result;

    const evaluable: EvaluableRule[] = rules.map((r) => ({
      id: r.id,
      type: r.type,
      priority: r.priority,
      action: r.action as RuleAction,
      conditions: r.conditions as RuleConditions,
    }));

    const engineBundle = this.buildEngine(evaluable);

    for (const { playerId, context } of contexts) {
      const output = await this.evaluateForPlayer(matchId, playerId, context, engineBundle, displayNames).catch(
        (err) => {
          logger.error({ err, matchId, playerId }, "[Rules] player evaluation failed");
          return null;
        },
      );
      if (output && (output.message || output.badges?.length)) result.set(playerId, output);
    }
    return result;
  }

  private async evaluateForPlayer(
    matchId: string,
    playerId: string,
    context: MatchSubmittedContext,
    engineBundle: { engine: Engine; byId: Map<string, EvaluableRule> },
    displayNames: Map<string, string>,
  ): Promise<PlayerRulesOutput> {
    const facts = context as unknown as Facts;
    const matched = await this.runEngine(engineBundle, facts);
    const output: PlayerRulesOutput = {};

    const messageRule = selectWinner(matched.filter((r) => r.type === "message"));
    if (messageRule) {
      output.message = interpolate(pickVariant(messageRule.action as MessageAction), resolveDisplay(facts, displayNames));
    }

    // Badges are awarded independently (no single-winner): every matching badge
    // rule grants its badge. This keeps awards order-independent so they can be
    // recomputed deterministically during reconciliation.
    const badgeRules = matched.filter((r) => r.type === "badge");
    for (const badgeRule of badgeRules) {
      // awardBadge uses onConflictDoNothing and returns null if badge already exists
      const awarded = await rulesRepository.awardBadge(playerId, badgeRule.id, matchId);
      if (!awarded) continue;
      const badge = badgeRule.action as BadgeAction;
      (output.badges ??= []).push({
        badgeId: awarded.id,
        ruleId: badgeRule.id,
        icon: badge.icon,
        label: badge.label,
        description: badge.description,
      });
    }

    return output;
  }

  private buildEngine(rules: EvaluableRule[]): { engine: Engine; byId: Map<string, EvaluableRule> } {
    const engine = new Engine([], { allowUndefinedFacts: true });
    const byId = new Map<string, EvaluableRule>();
    for (const rule of rules) {
      byId.set(rule.id, rule);
      engine.addRule({ conditions: rule.conditions as never, event: { type: "rule_matched", params: { ruleId: rule.id } } });
    }
    return { engine, byId };
  }

  private async runEngine(
    { engine, byId }: { engine: Engine; byId: Map<string, EvaluableRule> },
    facts: Facts,
  ): Promise<EvaluableRule[]> {
    const { events } = await engine.run(facts);
    const matched: EvaluableRule[] = [];
    for (const event of events) {
      const ruleId = event.params?.ruleId as string | undefined;
      const rule = ruleId ? byId.get(ruleId) : undefined;
      if (rule) matched.push(rule);
    }
    return matched;
  }

  /**
   * Simulator (admin editor "Test" button): evaluates an ephemeral rule
   * against a provided context, without writing to DB.
   */
  async simulate(conditions: RuleConditions, action: RuleAction, context: Facts): Promise<TestRuleResult> {
    const ephemeral: EvaluableRule = {
      id: "test",
      type: action.type,
      priority: 0,
      action,
      conditions,
    };
    const matched = await this.runEngine(this.buildEngine([ephemeral]), context);
    if (matched.length === 0) return { matched: false };

    if (action.type === "message") {
      return { matched: true, output: { type: "message", message: interpolate(pickVariant(action), context) } };
    }
    return {
      matched: true,
      output: {
        type: "badge",
        badge: { ruleId: "test", icon: action.icon, label: action.label, description: action.description },
      },
    };
  }
}

export const rulesEvaluationService = new RulesEvaluationService();
