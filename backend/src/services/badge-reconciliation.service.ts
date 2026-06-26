import { Engine } from "json-rules-engine";
import { rulesRepository } from "../repository/rules.repository";
import { rulesContextService } from "./rules-context.service";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { notificationService } from "./notification.service";
import { webSocketService } from "./websocket.service";
import { logger } from "../utils/logger";
import type { BadgeAction, MatchSubmittedContext, RuleConditions } from "@skol-arena/shared";

type Facts = Record<string, unknown>;

interface BadgeRule {
  id: string;
  conditions: RuleConditions;
  label: string;
}

/**
 * Keeps `player_badges` in sync with the current match history + active badge
 * rules. Two entry points:
 *  - `reconcilePlayers` — after an MMR cascade (match cancellation), re-evaluate
 *    every badge for the affected players in that season.
 *  - `reconcileRule` — after a badge rule is created/updated/reactivated,
 *    retroactively award it where it now matches and revoke it where it no
 *    longer does, across all ranked seasons.
 *
 * Badge facts are read in `historical` mode (per-match snapshot) so past matches
 * replay with the streak/MMR state they had at the time. Award-all semantics
 * (each badge rule evaluated independently) make this deterministic.
 */
export class BadgeReconciliationService {
  private buildEngine(rules: BadgeRule[]): Engine {
    const engine = new Engine([], { allowUndefinedFacts: true });
    for (const rule of rules) {
      engine.addRule({
        conditions: rule.conditions as never,
        event: { type: "rule_matched", params: { ruleId: rule.id } },
      });
    }
    return engine;
  }

  private async matchedRuleIds(engine: Engine, context: MatchSubmittedContext): Promise<Set<string>> {
    const { events } = await engine.run(context as unknown as Facts);
    const ids = new Set<string>();
    for (const event of events) {
      const ruleId = event.params?.ruleId as string | undefined;
      if (ruleId) ids.add(ruleId);
    }
    return ids;
  }

  /** Reconcile all badges for the given players within a single season. */
  async reconcilePlayers(seasonId: string, playerIds: string[]): Promise<void> {
    if (playerIds.length === 0) return;
    const season = await rankedSeasonRepository.getSeasonWithConfig(seasonId);
    if (!season) return;

    const active = await rulesRepository.listActiveByTrigger("match_submitted", season.disciplineId ?? null);
    const badgeRules: BadgeRule[] = active
      .filter((r) => r.type === "badge")
      .map((r) => ({ id: r.id, conditions: r.conditions as RuleConditions, label: (r.action as BadgeAction).label }));
    // No active badge rules → nothing to award; inactive-rule badges are kept.
    if (badgeRules.length === 0) return;

    const engine = this.buildEngine(badgeRules);

    for (const playerId of playerIds) {
      await this.reconcileOnePlayer(seasonId, playerId, engine, badgeRules).catch((err) =>
        logger.error({ err, seasonId, playerId }, "[BadgeReconcile] player failed"),
      );
    }
  }

  private async reconcileOnePlayer(
    seasonId: string,
    playerId: string,
    engine: Engine,
    badgeRules: BadgeRule[],
  ): Promise<void> {
    const labelById = new Map(badgeRules.map((r) => [r.id, r.label]));
    // Desired set: ruleId -> earliest matching match (chronological).
    const ordered = await playerMmrRepository.getMmrHistoryOrdered(seasonId, playerId);
    const desired = new Map<string, string>();
    for (const row of ordered) {
      const { contexts } = await rulesContextService.buildMatchSubmittedContexts(row.matchId, true);
      const ctx = contexts.find((c) => c.playerId === playerId);
      if (!ctx) continue;
      for (const ruleId of await this.matchedRuleIds(engine, ctx.context)) {
        if (!desired.has(ruleId)) desired.set(ruleId, row.matchId);
      }
    }

    // Only badges from this season whose rule is still active are in scope; a
    // deactivated rule's badges are intentionally kept.
    const current = await rulesRepository.listBadgesByPlayerAndSeason(playerId, seasonId);
    const currentActive = current.filter((b) => b.rule.isActive && b.rule.type === "badge");
    const heldRuleIds = new Set(currentActive.map((b) => b.ruleId));

    for (const badge of currentActive) {
      if (desired.has(badge.ruleId)) continue;
      await rulesRepository.revokeBadge(playerId, badge.ruleId);
      await this.notifyRevoked(playerId, (badge.rule.action as BadgeAction).label);
    }

    for (const [ruleId, matchId] of desired) {
      if (heldRuleIds.has(ruleId)) continue;
      await this.award(playerId, ruleId, matchId, labelById.get(ruleId) ?? "");
    }
  }

  /** Reconcile a single badge rule across all ranked seasons (create/update/reactivate). */
  async reconcileRule(ruleId: string): Promise<void> {
    const rule = await rulesRepository.getById(ruleId);
    if (!rule || rule.type !== "badge" || !rule.isActive) return;

    const action = rule.action as BadgeAction;
    const engine = this.buildEngine([{ id: rule.id, conditions: rule.conditions as RuleConditions, label: action.label }]);

    const seasons = await rankedSeasonRepository.listSeasons(
      rule.scope === "discipline" && rule.disciplineId ? { disciplineId: rule.disciplineId } : undefined,
    );

    // Desired holders: playerId -> earliest matching match across all seasons.
    const desired = new Map<string, string>();
    for (const season of seasons) {
      const matchIds = await playerMmrRepository.getSeasonMatchIdsOrdered(season.id);
      for (const matchId of matchIds) {
        const { contexts } = await rulesContextService.buildMatchSubmittedContexts(matchId, true);
        for (const ctx of contexts) {
          if (desired.has(ctx.playerId)) continue;
          if ((await this.matchedRuleIds(engine, ctx.context)).has(rule.id)) desired.set(ctx.playerId, matchId);
        }
      }
    }

    const holders = new Set(await rulesRepository.listBadgeHolderPlayerIds(rule.id));

    for (const [playerId, matchId] of desired) {
      if (!holders.has(playerId)) await this.award(playerId, rule.id, matchId, action.label);
    }
    for (const playerId of holders) {
      if (desired.has(playerId)) continue;
      await rulesRepository.revokeBadge(playerId, rule.id);
      await this.notifyRevoked(playerId, action.label);
    }
  }

  /** Reconcile every active badge rule (full nightly pass). */
  async reconcileAllActiveBadgeRules(): Promise<void> {
    const badgeRules = await rulesRepository.list({ type: "badge", isActive: true });
    for (const rule of badgeRules) {
      await this.reconcileRule(rule.id).catch((err) =>
        logger.error({ err, ruleId: rule.id }, "[BadgeReconcile] rule failed"),
      );
    }
  }

  /**
   * Entry point for the nightly cron and the manual admin trigger. Runs a full
   * reconciliation only when a badge rule changed since the last run (dirty), or
   * when forced. The dirty flag is cleared at the start so edits made during the
   * run are picked up by the next pass.
   */
  async runPendingReconciliation(force = false): Promise<{ ran: boolean }> {
    const state = await rulesRepository.getReconciliationState();
    if (!force && !state.dirty) {
      logger.info("[BadgeReconcile] nightly run skipped — no badge rule changes");
      return { ran: false };
    }
    await rulesRepository.clearDirtyAndStampRun();
    logger.info({ force }, "[BadgeReconcile] full reconciliation start");
    await this.reconcileAllActiveBadgeRules();
    logger.info("[BadgeReconcile] full reconciliation done");
    return { ran: true };
  }

  /** Notify holders then let the FK cascade remove the badges (hard delete of a rule). */
  async notifyHoldersBeforeDelete(ruleId: string): Promise<void> {
    const rule = await rulesRepository.getById(ruleId);
    if (!rule || rule.type !== "badge") return;
    const label = (rule.action as BadgeAction).label;
    const holders = await rulesRepository.listBadgeHolderPlayerIds(ruleId);
    for (const playerId of holders) {
      await this.notifyRevoked(playerId, label);
    }
  }

  private async award(playerId: string, ruleId: string, matchId: string, label: string): Promise<void> {
    const awarded = await rulesRepository.awardBadge(playerId, ruleId, matchId);
    if (!awarded) return;
    // Retroactive awards do not trigger the reveal animation — mark as viewed.
    await rulesRepository.markBadgesViewed([awarded.id], playerId);
    await notificationService
      .send({
        userId: playerId,
        type: "BADGE_AWARDED",
        titleKey: "notifications.BADGE_AWARDED_TITLE",
        messageKey: "notifications.BADGE_AWARDED_MESSAGE",
        translationParams: { badgeLabel: label },
        requiresAction: false,
      })
      .catch((err) => logger.error({ err, playerId }, "[BadgeReconcile] award notify failed"));
    webSocketService.send(playerId, { event: "badge_awarded", data: { ruleId } });
  }

  private async notifyRevoked(playerId: string, label: string): Promise<void> {
    await notificationService
      .send({
        userId: playerId,
        type: "BADGE_REVOKED",
        titleKey: "notifications.BADGE_REVOKED_TITLE",
        messageKey: "notifications.BADGE_REVOKED_MESSAGE",
        translationParams: { badgeLabel: label },
        requiresAction: false,
      })
      .catch((err) => logger.error({ err, playerId }, "[BadgeReconcile] revoke notify failed"));
    webSocketService.send(playerId, { event: "badge_revoked", data: {} });
  }
}

export const badgeReconciliationService = new BadgeReconciliationService();
