import { and, eq, inArray, isNull, or, desc, count } from "drizzle-orm";
import { db } from "../config/database";
import { badgeReconciliationState, matches, playerBadges, rules } from "../db/schema";
import type { RuleAction, RuleConditions, RuleScope, RuleType } from "@skill-arena/shared";

export interface CreateRuleData {
  triggerEvent: string;
  type: RuleType;
  scope: RuleScope;
  disciplineId?: string | null;
  priority?: number;
  name: string;
  description?: string | null;
  conditions: RuleConditions;
  action: RuleAction;
  isActive?: boolean;
  createdBy: string;
}

export interface UpdateRuleData {
  triggerEvent?: string;
  type?: RuleType;
  scope?: RuleScope;
  disciplineId?: string | null;
  priority?: number;
  name?: string;
  description?: string | null;
  conditions?: RuleConditions;
  action?: RuleAction;
  isActive?: boolean;
}

export interface RuleListFilters {
  type?: RuleType;
  triggerEvent?: string;
  scope?: RuleScope;
  isActive?: boolean;
}

export class RulesRepository {
  async create(data: CreateRuleData) {
    const [rule] = await db.insert(rules).values(data).returning();
    return rule;
  }

  async getById(id: string) {
    return await db.query.rules.findFirst({ where: eq(rules.id, id) });
  }

  async list(filters: RuleListFilters = {}) {
    const conditions = [];
    if (filters.type) conditions.push(eq(rules.type, filters.type));
    if (filters.triggerEvent) conditions.push(eq(rules.triggerEvent, filters.triggerEvent));
    if (filters.scope) conditions.push(eq(rules.scope, filters.scope));
    if (filters.isActive !== undefined) conditions.push(eq(rules.isActive, filters.isActive));

    return await db.query.rules.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: [desc(rules.priority), desc(rules.createdAt)],
    });
  }

  /**
   * Règles actives pour un événement, filtrées par scope (global, ou
   * discipline correspondante).
   */
  async listActiveByTrigger(triggerEvent: string, disciplineId: string | null) {
    const scopeFilter = disciplineId
      ? or(eq(rules.scope, "global"), and(eq(rules.scope, "discipline"), eq(rules.disciplineId, disciplineId)))
      : eq(rules.scope, "global");

    return await db.query.rules.findMany({
      where: and(eq(rules.triggerEvent, triggerEvent), eq(rules.isActive, true), scopeFilter),
      orderBy: [desc(rules.priority)],
    });
  }

  async update(id: string, data: UpdateRuleData) {
    const [updated] = await db.update(rules).set(data).where(eq(rules.id, id)).returning();
    return updated;
  }

  async delete(id: string) {
    await db.delete(rules).where(eq(rules.id, id));
  }

  // ---- Badges ----

  async awardBadge(playerId: string, ruleId: string, matchId: string | null) {
    const [badge] = await db
      .insert(playerBadges)
      .values({ playerId, ruleId, matchId })
      .onConflictDoNothing({ target: [playerBadges.playerId, playerBadges.ruleId] })
      .returning();
    return badge ?? null;
  }

  async listBadgesByPlayer(playerId: string) {
    return await db.query.playerBadges.findMany({
      where: eq(playerBadges.playerId, playerId),
      orderBy: [desc(playerBadges.awardedAt)],
      with: { rule: true },
    });
  }

  /** Unviewed badges (for the reveal animation) for a player in a given season. */
  async getUnviewedBadgesForSeason(playerId: string, seasonId: string) {
    return await db.query.playerBadges.findMany({
      where: and(
        eq(playerBadges.playerId, playerId),
        isNull(playerBadges.viewedAt),
        inArray(
          playerBadges.matchId,
          db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, seasonId)),
        ),
      ),
      orderBy: [desc(playerBadges.awardedAt)],
      with: { rule: true },
    });
  }

  async markBadgesViewed(ids: string[], playerId: string): Promise<void> {
    if (ids.length === 0) return;
    await db.update(playerBadges)
      .set({ viewedAt: new Date() })
      .where(and(inArray(playerBadges.id, ids), eq(playerBadges.playerId, playerId)));
  }

  // ---- Badge lifecycle (reconciliation / revocation) ----

  /** Remove a player's badge for a given rule (revocation). */
  async revokeBadge(playerId: string, ruleId: string): Promise<void> {
    await db
      .delete(playerBadges)
      .where(and(eq(playerBadges.playerId, playerId), eq(playerBadges.ruleId, ruleId)));
  }

  /** Badges a player holds whose awarding match belongs to the given season. */
  async listBadgesByPlayerAndSeason(playerId: string, seasonId: string) {
    return await db.query.playerBadges.findMany({
      where: and(
        eq(playerBadges.playerId, playerId),
        inArray(
          playerBadges.matchId,
          db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, seasonId)),
        ),
      ),
      with: { rule: true },
    });
  }

  /** Number of players currently holding the badge produced by a rule. */
  async countBadgeHolders(ruleId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(playerBadges)
      .where(eq(playerBadges.ruleId, ruleId));
    return row?.value ?? 0;
  }

  /** Player ids currently holding the badge produced by a rule. */
  async listBadgeHolderPlayerIds(ruleId: string): Promise<string[]> {
    const rows = await db
      .select({ playerId: playerBadges.playerId })
      .from(playerBadges)
      .where(eq(playerBadges.ruleId, ruleId));
    return rows.map((r) => r.playerId);
  }

  // ---- Nightly reconciliation state (dirty flag) ----

  /** Read the singleton reconciliation state, creating it if absent. */
  async getReconciliationState(): Promise<{ dirty: boolean; lastRunAt: Date | null }> {
    const existing = await db.query.badgeReconciliationState.findFirst();
    if (existing) return { dirty: existing.dirty, lastRunAt: existing.lastRunAt };
    const [created] = await db.insert(badgeReconciliationState).values({}).returning();
    return { dirty: created.dirty, lastRunAt: created.lastRunAt };
  }

  /** Flag that a badge rule changed and a reconciliation is needed. */
  async markBadgeRulesDirty(): Promise<void> {
    await this.getReconciliationState(); // ensure the row exists
    await db.update(badgeReconciliationState).set({ dirty: true });
  }

  /** Clear the dirty flag and stamp the run time (called when a run starts). */
  async clearDirtyAndStampRun(): Promise<void> {
    await this.getReconciliationState();
    await db.update(badgeReconciliationState).set({ dirty: false, lastRunAt: new Date() });
  }
}

export const rulesRepository = new RulesRepository();
