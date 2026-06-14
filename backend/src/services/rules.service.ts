import {
  EVENT_FACT_CATALOG,
  OPERATORS_BY_TYPE,
  TRIGGER_EVENTS,
  type CreateRuleData,
  type FactDefinition,
  type RuleAction,
  type RuleConditions,
  type TriggerEvent,
  type UpdateRuleData,
} from "@skill-arena/shared";
import {
  rulesRepository,
  type RuleListFilters,
  type CreateRuleData as CreateRuleRow,
} from "../repository/rules.repository";
import { rulesEvaluationService } from "./rules-evaluation.service";
import { BadRequestError, NotFoundError, ErrorCode } from "../types/errors";

function isTriggerEvent(value: string): value is TriggerEvent {
  return (TRIGGER_EVENTS as readonly string[]).includes(value);
}

/**
 * Vérifie que tous les facts référencés dans l'arbre de conditions existent
 * dans le catalogue de l'événement déclencheur.
 */
function collectFactKeys(conditions: RuleConditions, acc: Set<string>): void {
  if ("all" in conditions) conditions.all.forEach((c) => collectFactKeys(c, acc));
  else if ("any" in conditions) conditions.any.forEach((c) => collectFactKeys(c, acc));
  else acc.add(conditions.fact);
}

export class RulesService {
  list(filters: RuleListFilters) {
    return rulesRepository.list(filters);
  }

  async getById(id: string) {
    const rule = await rulesRepository.getById(id);
    if (!rule) throw new NotFoundError(ErrorCode.NOT_FOUND);
    return rule;
  }

  create(data: CreateRuleData, createdBy: string) {
    this.validateRule(data.triggerEvent, data.conditions, data.scope, data.disciplineId ?? null);
    return rulesRepository.create({ ...(data as CreateRuleRow), createdBy });
  }

  async update(id: string, data: UpdateRuleData) {
    await this.getById(id);
    if (data.triggerEvent && data.conditions) {
      this.validateRule(data.triggerEvent, data.conditions, data.scope ?? "global", data.disciplineId ?? null);
    }
    return rulesRepository.update(id, data);
  }

  async delete(id: string) {
    await this.getById(id);
    await rulesRepository.delete(id);
  }

  getCatalog(triggerEvent: string): { facts: (FactDefinition & { operators: string[] })[] } {
    if (!isTriggerEvent(triggerEvent)) throw new BadRequestError(ErrorCode.VALIDATION_ERROR);
    const facts = EVENT_FACT_CATALOG[triggerEvent].map((f) => ({ ...f, operators: OPERATORS_BY_TYPE[f.type] }));
    return { facts };
  }

  test(conditions: RuleConditions, action: RuleAction, context: Record<string, unknown>) {
    return rulesEvaluationService.simulate(conditions, action, context);
  }

  async getPlayerBadges(playerId: string) {
    const rows = await rulesRepository.listBadgesByPlayer(playerId);
    return rows.map((row) => {
      const action = row.rule.action as RuleAction;
      const badge = action.type === "badge" ? action : { icon: "", label: row.rule.name, description: "" };
      return {
        id: row.id,
        playerId: row.playerId,
        ruleId: row.ruleId,
        icon: badge.icon,
        label: badge.label,
        description: badge.description,
        awardedAt: row.awardedAt,
        matchId: row.matchId,
      };
    });
  }

  /** Pending (unviewed) badge animations for a player in a season. */
  async getPendingBadges(playerId: string, seasonId: string) {
    const rows = await rulesRepository.getUnviewedBadgesForSeason(playerId, seasonId);
    return rows.map((row) => {
      const action = row.rule.action as RuleAction;
      const badge = action.type === "badge" ? action : { icon: "", label: row.rule.name, description: "" };
      return {
        id: row.id,
        matchId: row.matchId,
        seasonId,
        icon: badge.icon,
        label: badge.label,
        description: badge.description,
        createdAt: row.awardedAt.toISOString(),
      };
    });
  }

  markBadgesViewed(ids: string[], playerId: string) {
    return rulesRepository.markBadgesViewed(ids, playerId);
  }

  private validateRule(
    triggerEvent: string,
    conditions: RuleConditions,
    scope: string,
    disciplineId: string | null,
  ): void {
    if (!isTriggerEvent(triggerEvent)) throw new BadRequestError(ErrorCode.VALIDATION_ERROR);
    if (scope === "discipline" && !disciplineId) throw new BadRequestError(ErrorCode.VALIDATION_ERROR);

    const allowed = new Set(EVENT_FACT_CATALOG[triggerEvent].map((f) => f.key));
    const used = new Set<string>();
    collectFactKeys(conditions, used);
    for (const fact of used) {
      if (!allowed.has(fact)) throw new BadRequestError(ErrorCode.VALIDATION_ERROR);
    }
  }
}

export const rulesService = new RulesService();
