import { z } from "zod";

// ============================================
// Rules engine — contextual messages & badges
// ============================================

export type RuleType = "message" | "badge";
export type RuleScope = "global" | "discipline";

/**
 * Application trigger events. Open for extension, but only
 * `match_submitted` is supported in v1.
 */
export const TRIGGER_EVENTS = ["match_submitted"] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

// ============================================
// Evaluation context per event (the "facts")
// ============================================

/**
 * Context provided for the `match_submitted` event. The engine is called
 * once per player involved (winner then loser).
 */
export interface MatchSubmittedContext {
  // Evaluated player and his match line-up
  playerId: string;
  teammateIds: string[];
  opponentIds: string[];

  // Match result (from the evaluated player's point of view)
  winnerId: string;
  loserId: string;
  scoreWinner: number;
  scoreLoser: number;
  matchScore: string;

  // MMR delta (Ranked mode)
  mmrDelta: number;
  newMmr: number;
  previousMmr: number;

  // Rank (Ranked mode)
  newRank: string;
  previousRank: string;
  rankChanged: boolean;
  rankUp: boolean;
  rankDown: boolean;

  // Streaks
  winStreak: number;
  lossStreak: number;

  // Player context
  isPlacementMatch: boolean;
  matchCountThisSeason: number;

  // Opponent context
  opponentRank: string;

  // Match date / time (Europe/Paris timezone)
  matchHour: number; // 0-23
  matchMinuteOfDay: number; // 0-1439 (minute of the day, minute precision)
  matchDayOfWeek: number; // 1=Monday … 7=Sunday
  matchDate: string; // 'YYYY-MM-DD'

  // Global context
  discipline: string;
  site: string;
}

// ============================================
// Fact catalog (used by the admin UI + backend validation)
// ============================================

export type FactType = "number" | "boolean" | "string" | "stringList" | "date";

export interface FactDefinition {
  key: string;
  label: string;
  type: FactType;
  sample: number | boolean | string | string[];
  /** Special reference: render a dedicated picker instead of a raw input. */
  ref?: "player" | "time" | "discipline" | "site" | "weekday";
}

export const MATCH_SUBMITTED_FACTS: FactDefinition[] = [
  { key: "playerId", label: "Joueur concerné", type: "string", sample: "", ref: "player" },
  { key: "teammateIds", label: "Coéquipiers", type: "stringList", sample: [], ref: "player" },
  { key: "opponentIds", label: "Adversaires", type: "stringList", sample: [], ref: "player" },
  { key: "winnerId", label: "Gagnant", type: "string", sample: "", ref: "player" },
  { key: "loserId", label: "Perdant", type: "string", sample: "", ref: "player" },
  { key: "scoreWinner", label: "Score du gagnant", type: "number", sample: 2 },
  { key: "scoreLoser", label: "Score du perdant", type: "number", sample: 1 },
  { key: "matchScore", label: "Score du match", type: "string", sample: "2-1" },
  { key: "mmrDelta", label: "Variation de MMR", type: "number", sample: 18 },
  { key: "newMmr", label: "Nouveau MMR", type: "number", sample: 1218 },
  { key: "previousMmr", label: "MMR précédent", type: "number", sample: 1200 },
  { key: "newRank", label: "Nouveau rang", type: "string", sample: "gold" },
  { key: "previousRank", label: "Rang précédent", type: "string", sample: "silver" },
  { key: "rankChanged", label: "Rang modifié", type: "boolean", sample: true },
  { key: "rankUp", label: "Montée de rang", type: "boolean", sample: true },
  { key: "rankDown", label: "Descente de rang", type: "boolean", sample: false },
  { key: "winStreak", label: "Série de victoires", type: "number", sample: 3 },
  { key: "lossStreak", label: "Série de défaites", type: "number", sample: 0 },
  { key: "isPlacementMatch", label: "Match de placement", type: "boolean", sample: false },
  { key: "matchCountThisSeason", label: "Matchs cette saison", type: "number", sample: 12 },
  { key: "opponentRank", label: "Rang de l'adversaire", type: "string", sample: "gold" },
  { key: "matchHour", label: "Heure du match (0-23)", type: "number", sample: 21 },
  { key: "matchMinuteOfDay", label: "Horaire du match (précis)", type: "number", sample: 1290, ref: "time" },
  { key: "matchDayOfWeek", label: "Jour de la semaine", type: "number", sample: 6, ref: "weekday" },
  { key: "matchDate", label: "Date du match (AAAA-MM-JJ)", type: "date", sample: "2026-06-12" },
  { key: "discipline", label: "Discipline", type: "string", sample: "", ref: "discipline" },
  { key: "site", label: "Organisation", type: "string", sample: "", ref: "site" },
  { key: "randomRoll", label: "Tirage aléatoire (0-99)", type: "number", sample: 50 },
];

/**
 * Facts that are re-drawn at every evaluation. Forbidden on badge rules: the
 * nightly reconciliation replays past matches and must stay deterministic.
 */
export const NON_DETERMINISTIC_FACTS = ["randomRoll"] as const;

export const EVENT_FACT_CATALOG: Record<TriggerEvent, FactDefinition[]> = {
  match_submitted: MATCH_SUBMITTED_FACTS,
};

/**
 * json-rules-engine operators allowed per fact type (used to populate the
 * builder's dropdowns and validate on the backend side).
 */
export const OPERATORS_BY_TYPE: Record<FactType, string[]> = {
  number: ["greaterThan", "greaterThanInclusive", "lessThan", "lessThanInclusive", "equal", "notEqual", "in", "notIn"],
  boolean: ["equal", "notEqual"],
  string: ["equal", "notEqual", "in", "notIn", "contains", "doesNotContain"],
  stringList: ["contains", "doesNotContain"],
  date: ["equal", "notEqual", "greaterThan", "greaterThanInclusive", "lessThan", "lessThanInclusive"],
};

// ============================================
// Actions
// ============================================

export interface MessageAction {
  type: "message";
  variants: string[];
}

export interface BadgeAction {
  type: "badge";
  icon: string;
  label: string;
  description: string;
}

export type RuleAction = MessageAction | BadgeAction;

// ============================================
// Conditions (serialized json-rules-engine tree)
// ============================================

export interface ConditionLeaf {
  fact: string;
  operator: string;
  value: unknown;
}

export interface ConditionGroupAll {
  all: RuleConditions[];
}

export interface ConditionGroupAny {
  any: RuleConditions[];
}

export type RuleConditions = ConditionGroupAll | ConditionGroupAny | ConditionLeaf;

// ============================================
// Rule
// ============================================

// Declared after the condition and action schemas it references — see the "Zod
// schemas" section below. Kept as an explicit type annotation because the condition
// tree is recursive and cannot be inferred.
export const ruleSchema: z.ZodType<Rule> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      triggerEvent: z.enum(TRIGGER_EVENTS),
      type: z.enum(["message", "badge"]),
      scope: z.enum(["global", "discipline"]),
      disciplineId: z.string().nullable(),
      priority: z.number().int(),
      name: z.string(),
      description: z.string().nullable(),
      conditions: ruleConditionsSchema,
      action: ruleActionSchema,
      isActive: z.boolean(),
      createdBy: z.string(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    })
    .meta({ id: "Rule" })
);

export const ruleListSchema = z.array(ruleSchema);

export interface Rule {
  id: string;
  triggerEvent: TriggerEvent;
  type: RuleType;
  scope: RuleScope;
  disciplineId: string | null;
  priority: number;
  name: string;
  description: string | null;
  conditions: RuleConditions;
  action: RuleAction;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientRule extends Omit<Rule, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Sortie du moteur
// ============================================

/** Declared from rulesOutputBadgeSchema further down, in the Zod schemas section. */
export type RulesOutputBadge = z.infer<typeof rulesOutputBadgeSchema>;

/** Result of the rules evaluation for a player (internal backend). */
export interface PlayerRulesOutput {
  message?: string;
  /** All badges newly awarded during this evaluation. */
  badges?: (RulesOutputBadge & { badgeId: string })[];
}

// ============================================
// Badge animation (parity with mmr_animation)
// ============================================

export interface BadgeAnimationResponse {
  id: string; // player_badges.id
  matchId: string | null;
  seasonId: string;
  icon: string;
  label: string;
  description: string;
  createdAt: string;
}

export interface BadgeAnimationWsPayload extends BadgeAnimationResponse {
  tournamentId: string;
}

// ============================================
// Zod schemas
// ============================================

const conditionLeafSchema: z.ZodType<ConditionLeaf> = z.object({
  fact: z.string().min(1),
  operator: z.string().min(1),
  value: z.unknown(),
});

export const ruleConditionsSchema: z.ZodType<RuleConditions> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ruleConditionsSchema) }),
    z.object({ any: z.array(ruleConditionsSchema) }),
    conditionLeafSchema,
  ]),
);

export const messageActionSchema = z.object({
  type: z.literal("message"),
  variants: z
    .array(z.string().min(1, "La variante ne peut pas être vide"))
    .min(1, "Au moins une variante est requise")
    .max(10, "10 variantes maximum"),
});

export const badgeActionSchema = z.object({
  type: z.literal("badge"),
  icon: z.string().min(1, "L'icône est requise"),
  label: z.string().min(1, "Le label est requis").max(60),
  description: z.string().min(1, "La description est requise").max(200),
});

export const ruleActionSchema = z.discriminatedUnion("type", [messageActionSchema, badgeActionSchema]);

export const createRuleSchema = z.object({
  triggerEvent: z.enum(TRIGGER_EVENTS),
  type: z.enum(["message", "badge"]),
  scope: z.enum(["global", "discipline"]),
  disciplineId: z.string().uuid().nullable().optional(),
  priority: z.number().int().default(0),
  name: z.string().min(2, "Le nom est requis").max(120),
  description: z.string().max(500).nullable().optional(),
  conditions: ruleConditionsSchema,
  action: ruleActionSchema,
  isActive: z.boolean().default(true),
});

export const updateRuleSchema = createRuleSchema.partial();

/**
 * Rule simulator schema (admin editor "Test" button).
 */
export const testRuleSchema = z.object({
  triggerEvent: z.enum(TRIGGER_EVENTS),
  conditions: ruleConditionsSchema,
  action: ruleActionSchema,
  context: z.record(z.string(), z.unknown()),
});

// ============================================
// Player badges
// ============================================

export const playerBadgeSchema = z
  .object({
    id: z.string(),
    playerId: z.string(),
    ruleId: z.string(),
    icon: z.string(),
    label: z.string(),
    description: z.string(),
    awardedAt: z.iso.datetime(),
    matchId: z.string().nullable(),
  })
  .meta({ id: "PlayerBadge" });

export type PlayerBadge = z.infer<typeof playerBadgeSchema>;

/**
 * Same badge after the frontend interceptor has revived `awardedAt`. Used wherever
 * a payload is described from the client's point of view — the rewind, notably.
 */
export const clientPlayerBadgeSchema = playerBadgeSchema
  .extend({ awardedAt: z.date() })
  .meta({ id: "ClientPlayerBadge" });

export type ClientPlayerBadge = z.infer<typeof clientPlayerBadgeSchema>;

/** A badge a player can earn in a tournament (global or discipline-scoped rule). */
export const availableBadgeSchema = z
  .object({
    ruleId: z.string(),
    icon: z.string(),
    label: z.string(),
    description: z.string(),
    scope: z.enum(["global", "discipline"]),
  })
  .meta({ id: "AvailableBadge" });

export type AvailableBadge = z.infer<typeof availableBadgeSchema>;

// ============================================
// Inferred types
// ============================================

export type CreateRuleData = z.infer<typeof createRuleSchema>;
export type UpdateRuleData = z.infer<typeof updateRuleSchema>;
export type TestRuleData = z.infer<typeof testRuleSchema>;

export const rulesOutputBadgeSchema = z
  .object({
    ruleId: z.string(),
    icon: z.string(),
    label: z.string(),
    description: z.string(),
  })
  .meta({ id: "RulesOutputBadge" });

export const testRuleResultSchema = z
  .object({
    matched: z.boolean(),
    output: z
      .union([
        z.object({ type: z.literal("message"), message: z.string() }),
        z.object({ type: z.literal("badge"), badge: rulesOutputBadgeSchema }),
      ])
      .optional(),
  })
  .meta({ id: "TestRuleResult" });

export type TestRuleResult = z.infer<typeof testRuleResultSchema>;

/** Fact the rule editor offers, with the operators that apply to its type. */
export const factCatalogSchema = z
  .object({
    facts: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(["number", "boolean", "string", "stringList", "date"]),
        sample: z.union([z.number(), z.boolean(), z.string(), z.array(z.string())]),
        ref: z.enum(["player", "time", "discipline", "site", "weekday"]).optional(),
        operators: z.array(z.string()),
      })
    ),
  })
  .meta({ id: "FactCatalog" });

export const badgeReconciliationStateSchema = z
  .object({
    dirty: z.boolean(),
    lastRunAt: z.date().nullable(),
  })
  .meta({ id: "BadgeReconciliationState" });
