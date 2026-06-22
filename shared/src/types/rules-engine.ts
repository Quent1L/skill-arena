import { z } from "zod";

// ============================================
// Moteur de règles — messages contextuels & badges
// ============================================

export type RuleType = "message" | "badge";
export type RuleScope = "global" | "discipline";

/**
 * Événements applicatifs déclencheurs. Ouvert à l'extension, mais seul
 * `match_submitted` est supporté en v1.
 */
export const TRIGGER_EVENTS = ["match_submitted"] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

// ============================================
// Contexte d'évaluation par événement (les "facts")
// ============================================

/**
 * Contexte fourni pour l'événement `match_submitted`. Le moteur est appelé
 * une fois par joueur impliqué (gagnant puis perdant).
 */
export interface MatchSubmittedContext {
  // Résultat du match (du point de vue du joueur évalué)
  winnerId: string;
  loserId: string;
  scoreWinner: number;
  scoreLoser: number;
  matchScore: string;

  // Delta MMR (mode Ranked)
  mmrDelta: number;
  newMmr: number;
  previousMmr: number;

  // Rang (mode Ranked)
  newRank: string;
  previousRank: string;
  rankChanged: boolean;
  rankUp: boolean;
  rankDown: boolean;

  // Séries
  winStreak: number;
  lossStreak: number;

  // Contexte joueur
  isPlacementMatch: boolean;
  matchCountThisSeason: number;

  // Contexte adversaire
  opponentRank: string;

  // Date / horaire du match (fuseau Europe/Paris)
  matchHour: number; // 0-23
  matchMinuteOfDay: number; // 0-1439 (minute dans la journée, précision à la minute)
  matchDayOfWeek: number; // 1=lundi … 7=dimanche
  matchDate: string; // 'YYYY-MM-DD'

  // Contexte global
  discipline: string;
  site: string;
}

// ============================================
// Catalogue de facts (utilisé par l'UI admin + validation backend)
// ============================================

export type FactType = "number" | "boolean" | "string";

export interface FactDefinition {
  key: string;
  label: string;
  type: FactType;
  sample: number | boolean | string;
  /** Special reference: render a dedicated picker instead of a raw input. */
  ref?: "player" | "time";
}

export const MATCH_SUBMITTED_FACTS: FactDefinition[] = [
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
  { key: "matchDayOfWeek", label: "Jour de la semaine (1=lundi … 7=dimanche)", type: "number", sample: 6 },
  { key: "matchDate", label: "Date du match (AAAA-MM-JJ)", type: "string", sample: "2026-06-12" },
  { key: "discipline", label: "Discipline", type: "string", sample: "" },
  { key: "site", label: "Organisation", type: "string", sample: "" },
];

export const EVENT_FACT_CATALOG: Record<TriggerEvent, FactDefinition[]> = {
  match_submitted: MATCH_SUBMITTED_FACTS,
};

/**
 * Opérateurs json-rules-engine autorisés par type de fact (pour peupler les
 * dropdowns du builder et valider côté backend).
 */
export const OPERATORS_BY_TYPE: Record<FactType, string[]> = {
  number: ["greaterThan", "greaterThanInclusive", "lessThan", "lessThanInclusive", "equal", "notEqual", "in", "notIn"],
  boolean: ["equal", "notEqual"],
  string: ["equal", "notEqual", "in", "notIn", "contains", "doesNotContain"],
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
// Conditions (arbre json-rules-engine sérialisé)
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
// Règle
// ============================================

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

export interface RulesOutputBadge {
  ruleId: string;
  icon: string;
  label: string;
  description: string;
}

/** Résultat de l'évaluation des règles pour un joueur (interne backend). */
export interface PlayerRulesOutput {
  message?: string;
  /** Tous les badges nouvellement attribués lors de cette évaluation. */
  badges?: (RulesOutputBadge & { badgeId: string })[];
}

// ============================================
// Animation de badge (parité avec mmr_animation)
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
// Schémas Zod
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
 * Schéma du simulateur de règle (bouton "Tester" de l'éditeur admin).
 */
export const testRuleSchema = z.object({
  triggerEvent: z.enum(TRIGGER_EVENTS),
  conditions: ruleConditionsSchema,
  action: ruleActionSchema,
  context: z.record(z.string(), z.unknown()),
});

// ============================================
// Badges joueur
// ============================================

export interface PlayerBadge {
  id: string;
  playerId: string;
  ruleId: string;
  icon: string;
  label: string;
  description: string;
  awardedAt: string;
  matchId: string | null;
}

export interface ClientPlayerBadge extends Omit<PlayerBadge, "awardedAt"> {
  awardedAt: Date;
}

/** A badge a player can earn in a tournament (global or discipline-scoped rule). */
export interface AvailableBadge {
  ruleId: string;
  icon: string;
  label: string;
  description: string;
  scope: RuleScope;
}

// ============================================
// Types inférés
// ============================================

export type CreateRuleData = z.infer<typeof createRuleSchema>;
export type UpdateRuleData = z.infer<typeof updateRuleSchema>;
export type TestRuleData = z.infer<typeof testRuleSchema>;

export interface TestRuleResult {
  matched: boolean;
  output?: { type: "message"; message: string } | { type: "badge"; badge: RulesOutputBadge };
}
