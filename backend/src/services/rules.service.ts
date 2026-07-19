import {
  EVENT_FACT_CATALOG,
  NON_DETERMINISTIC_FACTS,
  OPERATORS_BY_TYPE,
  TRIGGER_EVENTS,
  type AvailableBadge,
  type BadgeAction,
  type CreateRuleData,
  type FactDefinition,
  type RuleAction,
  type RuleConditions,
  type TriggerEvent,
  type UpdateRuleData,
} from "@skol-arena/shared";
import {
  rulesRepository,
  type RuleListFilters,
  type CreateRuleData as CreateRuleRow,
} from "../repository/rules.repository";
import { rulesEvaluationService } from "./rules-evaluation.service";
import { badgeReconciliationService } from "./badge-reconciliation.service";
import { enqueueBadgeReconciliation } from "./mmr-job-queue.service";
import { BadRequestError, NotFoundError, ErrorCode } from "../types/errors";

function isTriggerEvent(value: string): value is TriggerEvent {
  return (TRIGGER_EVENTS as readonly string[]).includes(value);
}

/**
 * Verifies that all facts referenced in the conditions tree exist
 * in the trigger event's catalog.
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

  async create(data: CreateRuleData, createdBy: string) {
    this.validateRule(data.triggerEvent, data.conditions, data.scope, data.disciplineId ?? null, data.type);
    const rule = await rulesRepository.create({ ...(data as CreateRuleRow), createdBy });
    // Do NOT recompute now: a reconciliation pass can be long and the admin may
    // keep editing. Just flag it dirty — the nightly cron (or a manual trigger)
    // runs the actual recompute.
    if (rule.type === "badge" && rule.isActive) await rulesRepository.markBadgeRulesDirty();
    return rule;
  }

  async update(id: string, data: UpdateRuleData) {
    const existing = await this.getById(id);
    if (data.triggerEvent && data.conditions) {
      // `type` may be absent from a partial PATCH — fall back to the stored one.
      this.validateRule(
        data.triggerEvent,
        data.conditions,
        data.scope ?? "global",
        data.disciplineId ?? null,
        data.type ?? existing.type,
      );
    }
    const rule = await rulesRepository.update(id, data);
    // Flag dirty for the nightly/manual recompute (deactivation keeps badges, so skip).
    if (rule.type === "badge" && rule.isActive) await rulesRepository.markBadgeRulesDirty();
    return rule;
  }

  async delete(id: string) {
    const rule = await this.getById(id);
    // Inform current holders before the FK cascade removes their badges.
    if (rule.type === "badge") await badgeReconciliationService.notifyHoldersBeforeDelete(id);
    await rulesRepository.delete(id);
  }

  /** Number of players currently holding the badge produced by a rule (delete confirm). */
  getBadgeCount(id: string) {
    return rulesRepository.countBadgeHolders(id);
  }

  /** Active badge rules earnable for a discipline (global + that discipline). */
  async listAvailableBadges(disciplineId: string | null): Promise<AvailableBadge[]> {
    const rules = await rulesRepository.listActiveByTrigger("match_submitted", disciplineId);
    return rules
      .filter((r) => r.type === "badge")
      .map((r) => {
        const action = r.action as BadgeAction;
        return { ruleId: r.id, icon: action.icon, label: action.label, description: action.description, scope: r.scope };
      });
  }

  /** Current state of the nightly badge reconciliation (admin UI). */
  getReconciliationState() {
    return rulesRepository.getReconciliationState();
  }

  /** Manually queue a full badge reconciliation now (admin button). */
  triggerReconciliation() {
    return enqueueBadgeReconciliation(true);
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
    type: string,
  ): void {
    if (!isTriggerEvent(triggerEvent)) throw new BadRequestError(ErrorCode.VALIDATION_ERROR);
    if (scope === "discipline" && !disciplineId) throw new BadRequestError(ErrorCode.VALIDATION_ERROR);

    const allowed = new Set(EVENT_FACT_CATALOG[triggerEvent].map((f) => f.key));
    const used = new Set<string>();
    collectFactKeys(conditions, used);
    for (const fact of used) {
      if (!allowed.has(fact)) throw new BadRequestError(ErrorCode.VALIDATION_ERROR);
      // Badge awards are replayed by the nightly reconciliation: a random fact
      // would grant/revoke badges at every pass.
      if (type === "badge" && (NON_DETERMINISTIC_FACTS as readonly string[]).includes(fact)) {
        throw new BadRequestError(ErrorCode.RANDOM_NOT_ALLOWED_ON_BADGE);
      }
    }
  }
}

export const rulesService = new RulesService();
