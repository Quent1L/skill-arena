import { z } from "zod";
import { validationModeSchema } from "./enums";
import {
  baseSeasonFormSchema,
  baseSeasonUpdateFormSchema,
  dateRangePredicate,
  dateRangeError,
  teamSizePredicate,
  teamSizeError,
  scoreRangePredicate,
  scoreRangeError,
} from "./season-form";

// ============================================
// Types and interfaces for Ranked mode
// ============================================

/**
 * What happens to the MMR thresholds of a ladder copied from another season.
 * `keep` copies them verbatim; `percentile` rebuilds them from the source
 * season's peak-MMR distribution. Nothing else ever rewrites them on its own —
 * the admin recalculation stays a manual action.
 */
export type TierScalingMode = "keep" | "percentile";

export const tierScalingModes: readonly TierScalingMode[] = ["keep", "percentile"];

export const rankedSeasonConfigSchema = z
  .object({
    id: z.string(),
    tournamentId: z.string(),
    baseMmr: z.number().int(),
    kFactor: z.number().int(),
    placementMatches: z.number().int(),
    usePreviousMmr: z.boolean(),
    /** Share of a player's distance to the source season's median MMR that is kept. */
    softResetFactor: z.number(),
    allowAsymmetricMatches: z.boolean(),
    sourceTierSeasonId: z.string().nullish(),
    tierScalingMode: z.enum(["keep", "percentile"]),
    /** Season the MMR is carried over from. Null = last finished season. */
    sourceMmrSeasonId: z.string().nullish(),
  })
  .meta({ id: "RankedSeasonConfig" });

export type RankedSeasonConfig = z.infer<typeof rankedSeasonConfigSchema>;

export const playerMmrSchema = z
  .object({
    id: z.string(),
    seasonId: z.string(),
    playerId: z.string(),
    currentMmr: z.number(),
    matchesPlayed: z.number().int(),
    wins: z.number().int(),
    losses: z.number().int(),
    draws: z.number().int(),
    winStreak: z.number().int(),
    maxWinStreak: z.number().int(),
    lossStreak: z.number().int(),
    maxLossStreak: z.number().int(),
  })
  .meta({ id: "PlayerMmr" });

export type PlayerMmr = z.infer<typeof playerMmrSchema>;

export type MmrHistoryOutcome = 'win' | 'loss' | 'draw';

export const mmrChartPointSchema = z
  .object({
    mmrBefore: z.number(),
    mmrAfter: z.number(),
    mmrDelta: z.number(),
    outcome: z.enum(["win", "loss", "draw"]).nullish(),
    playedAt: z.date(),
  })
  .meta({ id: "MmrChartPoint" });

export type MmrChartPoint = z.infer<typeof mmrChartPointSchema>;

// Net MMR variation of a player over a time window (a calendar week today).
export const weeklyMmrLeaderSchema = z
  .object({
    playerId: z.string(),
    displayName: z.string(),
    shortName: z.string(),
    mmrGained: z.number(),
    matchesPlayed: z.number().int(),
  })
  .meta({ id: "WeeklyMmrLeader" });

export type WeeklyMmrLeader = z.infer<typeof weeklyMmrLeaderSchema>;

export const weeklyMmrLeadersSchema = z
  .object({
    weekStart: z.date(),
    gainers: z.array(weeklyMmrLeaderSchema),
    losers: z.array(weeklyMmrLeaderSchema),
  })
  .meta({ id: "WeeklyMmrLeaders" });

export type WeeklyMmrLeaders = z.infer<typeof weeklyMmrLeadersSchema>;

export const mmrHistoryEntrySchema = z
  .object({
    id: z.string(),
    seasonId: z.string(),
    playerId: z.string(),
    matchId: z.string(),
    mmrBefore: z.number(),
    mmrAfter: z.number(),
    mmrDelta: z.number(),
    kEffective: z.number(),
    opponentAvgMmr: z.number(),
    isPlacement: z.boolean(),
    outcome: z.enum(["win", "loss", "draw"]).nullish(),
  })
  .meta({ id: "MmrHistoryEntry" });

export type MmrHistoryEntry = z.infer<typeof mmrHistoryEntrySchema>;

export const clientRankTierSchema = z
  .object({
    id: z.string(),
    seasonId: z.string(),
    level: z.number().int(),
    name: z.string(),
    percentile: z.number(),
    minMmr: z.number(),
    subRanks: z.number().int(),
    iconClass: z.string().nullish(),
    calculatedAt: z.date(),
  })
  .meta({ id: "RankTier" });

export type ClientRankTier = z.infer<typeof clientRankTierSchema>;

export const clientRankTierListSchema = z.array(clientRankTierSchema);

// ============================================
// Client types (dates converted to Date)
// ============================================

/**
 * MMR gap past which an opposition counts as "stronger" rather than "even".
 * Shared so the profile's win rate by opponent level and the rewind's giant
 * killing answer to the same definition — a win over someone five points above
 * is not a feat.
 */
export const STRONGER_OPPONENT_MMR_GAP = 100;

export const opponentQualityBucketSchema = z
  .object({
    wins: z.number().int(),
    losses: z.number().int(),
    draws: z.number().int(),
    matchesPlayed: z.number().int(),
    winRate: z.number(),
  })
  .meta({ id: "OpponentQualityBucket" });

export type OpponentQualityBucket = z.infer<typeof opponentQualityBucketSchema>;

export const opponentQualityStatsSchema = z
  .object({
    vsStronger: opponentQualityBucketSchema,
    vsEqual: opponentQualityBucketSchema,
    vsWeaker: opponentQualityBucketSchema,
  })
  .meta({ id: "OpponentQualityStats" });

export type OpponentQualityStats = z.infer<typeof opponentQualityStatsSchema>;

export const clientPlayerMmrSchema = playerMmrSchema
  .extend({
    player: z
      .object({ id: z.string(), displayName: z.string(), shortName: z.string() })
      .optional(),
    recentResults: z
      .array(z.object({ outcome: z.enum(["win", "loss", "draw"]) }))
      .optional(),
    opponentQuality: opponentQualityStatsSchema.optional(),
  })
  .meta({ id: "ClientPlayerMmr" });

export type ClientPlayerMmr = z.infer<typeof clientPlayerMmrSchema>;

// A leaderboard row for a finished season, ranked on a metric aggregated over the
// whole season instead of the player's MMR at the closing bell.
export const clientSeasonMmrPlayerSchema = clientPlayerMmrSchema
  .extend({
    peakMmr: z.number(),
    avgMmr: z.number(),
  })
  .meta({ id: "SeasonMmrPlayer" });

export type ClientSeasonMmrPlayer = z.infer<typeof clientSeasonMmrPlayerSchema>;

export const historyMatchSidePlayerSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    shortName: z.string(),
  })
  .meta({ id: "HistoryMatchSidePlayer" });

export type HistoryMatchSidePlayer = z.infer<typeof historyMatchSidePlayerSchema>;

export const historyMatchSideSchema = z
  .object({
    position: z.number().int(),
    players: z.array(historyMatchSidePlayerSchema),
  })
  .meta({ id: "HistoryMatchSide" });

export type HistoryMatchSide = z.infer<typeof historyMatchSideSchema>;

export const clientMmrHistoryEntrySchema = mmrHistoryEntrySchema
  .extend({
    match: z
      .object({ id: z.string(), playedAt: z.date(), status: z.string() })
      .optional(),
    teamSizeA: z.number().int().nullish(),
    teamSizeB: z.number().int().nullish(),
    sides: z.array(historyMatchSideSchema).optional(),
  })
  .meta({ id: "MmrHistoryEntryWithMatch" });

export type ClientMmrHistoryEntry = z.infer<typeof clientMmrHistoryEntrySchema>;

export const clientMmrHistoryListSchema = z.array(clientMmrHistoryEntrySchema);

/** Leaderboard payload: the rows plus the placement threshold in force. */
export const rankedLeaderboardSchema = z
  .object({
    players: z.array(clientPlayerMmrSchema),
    placementMatches: z.number().int(),
  })
  .meta({ id: "RankedLeaderboard" });

export const seasonMmrLeaderboardSchema = z
  .object({ players: z.array(clientSeasonMmrPlayerSchema) })
  .meta({ id: "SeasonMmrLeaderboard" });

/** Everything the player MMR profile page needs, in one call. */
export const playerMmrProfileSchema = z
  .object({
    mmr: clientPlayerMmrSchema,
    tiers: z.array(clientRankTierSchema),
    opponentQuality: opponentQualityStatsSchema,
    chartHistory: z.array(mmrChartPointSchema),
    placementMatches: z.number().int(),
  })
  .meta({ id: "PlayerMmrProfile" });

/** Season summary row, as listed by GET /ranked/seasons. */
export const rankedSeasonListItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    mode: z.string(),
    teamMode: z.string(),
    status: z.string(),
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
    disciplineId: z.string().nullable(),
    discipline: z
      .object({ id: z.string(), name: z.string(), icon: z.string().nullable() })
      .nullable(),
    participantCount: z.number().int(),
    /** Whether the requesting user has a player_mmr row in the season. */
    isParticipant: z.boolean(),
  })
  .meta({ id: "RankedSeasonListItem" });

/** Trimmed row used to populate the "copy tiers from" dropdown. */
export const finishedRankedSeasonSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
    discipline: z
      .object({ id: z.string(), name: z.string(), icon: z.string().nullable() })
      .nullable(),
  })
  .meta({ id: "FinishedRankedSeason" });

/** A season with its MMR config and ladder, as returned by the detail endpoints. */
export const rankedSeasonDetailSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    mode: z.string(),
    teamMode: z.string(),
    status: z.string(),
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
    disciplineId: z.string().nullable(),
    rankedConfig: rankedSeasonConfigSchema.nullable(),
    rankTiers: z.array(clientRankTierSchema),
    discipline: z
      .object({ id: z.string(), name: z.string(), icon: z.string().nullable() })
      .nullable(),
    rules: z.object({ id: z.string() }).nullable(),
  })
  .meta({ id: "RankedSeasonDetail" });

export const markViewedResultSchema = z
  .object({
    success: z.boolean(),
    markedCount: z.number().int(),
  })
  .meta({ id: "MarkViewedResult" });

// ============================================
// Zod schemas for validation
// ============================================

// ============================================
// Schemas for the form (frontend, Date dates)
// ============================================
// Extends baseSeasonFormSchema (fields shared with tournaments) by adding
// fields specific to ranked seasons (MMR config).
const rankedSeasonExtraFields = {
  baseMmr: z.number().int().min(100).max(5000),
  kFactor: z.number().int().min(8).max(128),
  placementMatches: z.number().int().min(0).max(20),
  usePreviousMmr: z.boolean(),
  softResetFactor: z.number().min(0).max(1),
  allowAsymmetricMatches: z.boolean(),
  sourceTierSeasonId: z.string().uuid().nullable().optional(),
  tierScalingMode: z.enum(["keep", "percentile"]),
  sourceMmrSeasonId: z.string().uuid().nullable().optional(),
};

export const baseRankedSeasonFormSchema =
  baseSeasonFormSchema.extend(rankedSeasonExtraFields);

export const baseRankedSeasonUpdateFormSchema =
  baseSeasonUpdateFormSchema.extend({
    baseMmr: z.number().int().min(100).max(5000).optional(),
    kFactor: z.number().int().min(8).max(128).optional(),
    placementMatches: z.number().int().min(0).max(20).optional(),
    usePreviousMmr: z.boolean().optional(),
    softResetFactor: z.number().min(0).max(1).optional(),
    allowAsymmetricMatches: z.boolean().optional(),
    sourceTierSeasonId: z.string().uuid().nullable().optional(),
    tierScalingMode: z.enum(["keep", "percentile"]).optional(),
    sourceMmrSeasonId: z.string().uuid().nullable().optional(),
  });

export const createRankedSeasonFormSchema = baseRankedSeasonFormSchema
  .refine(dateRangePredicate, dateRangeError)
  .refine(teamSizePredicate, teamSizeError)
  .refine(scoreRangePredicate, scoreRangeError);

export const updateRankedSeasonFormSchema = baseRankedSeasonUpdateFormSchema
  .refine(dateRangePredicate, dateRangeError)
  .refine(teamSizePredicate, teamSizeError)
  .refine(scoreRangePredicate, scoreRangeError);

export type BaseRankedSeasonFormData = z.infer<
  typeof baseRankedSeasonFormSchema
>;
export type CreateRankedSeasonFormData = z.infer<
  typeof createRankedSeasonFormSchema
>;
export type UpdateRankedSeasonFormData = z.infer<
  typeof updateRankedSeasonFormSchema
>;

// ============================================
// Schemas for the API (backend, string dates)
// ============================================

export const createRankedSeasonSchema = z
  .object({
    name: z
      .string({ message: "Le nom est requis" })
      .min(3, "Le nom doit contenir au moins 3 caractères")
      .max(100, "Le nom ne peut pas dépasser 100 caractères"),
    description: z
      .string()
      .max(500, "La description ne peut pas dépasser 500 caractères")
      .optional(),
    disciplineId: z
      .string({ message: "La discipline est requise" })
      .uuid("ID de discipline invalide"),
    startDate: z
      .string()
      .datetime()
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    endDate: z
      .string()
      .datetime()
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    minTeamSize: z
      .number({ message: "La taille minimale de l'équipe est requise" })
      .int()
      .min(1, "La taille minimale est 1"),
    maxTeamSize: z
      .number({ message: "La taille maximale de l'équipe est requise" })
      .int()
      .min(1, "La taille minimale est 1"),
    rulesId: z.string().uuid().nullable().optional(),
    organizationId: z.string().uuid().nullable().optional(),
    allowDraw: z.boolean().default(true).optional(),
    // Score configuration
    scoreEnabled: z.boolean().default(true).optional(),
    minScore: z.number().int().min(0).nullable().optional(),
    maxScore: z.number().int().min(0).nullable().optional(),
    // Ranked-specific config
    ...rankedSeasonExtraFields,
    validationMode: validationModeSchema.default("strict").optional(),
    validationTimerHours: z.number().int().min(1).max(168).nullable().optional(),
  })
  .refine(dateRangePredicate, dateRangeError)
  .refine(teamSizePredicate, teamSizeError)
  .refine(scoreRangePredicate, scoreRangeError);

export const updateRankedSeasonSchema = z.object({
  name: z
    .string()
    .min(3, "Le nom doit contenir au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
  description: z
    .string()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional(),
  startDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  endDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  rulesId: z.string().uuid().nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  allowDraw: z.boolean().optional(),
  scoreEnabled: z.boolean().optional(),
  minScore: z.number().int().min(0).nullable().optional(),
  maxScore: z.number().int().min(0).nullable().optional(),
  baseMmr: z.number().int().min(100).max(5000).optional(),
  kFactor: z.number().int().min(8).max(128).optional(),
  placementMatches: z.number().int().min(1).max(20).optional(),
  usePreviousMmr: z.boolean().optional(),
  softResetFactor: z.number().min(0).max(1).optional(),
  allowAsymmetricMatches: z.boolean().optional(),
  sourceTierSeasonId: z.string().uuid().nullable().optional(),
  tierScalingMode: z.enum(["keep", "percentile"]).optional(),
  sourceMmrSeasonId: z.string().uuid().nullable().optional(),
  validationMode: validationModeSchema.optional(),
  validationTimerHours: z.number().int().min(1).max(168).nullable().optional(),
});

// ============================================
// Types inferred from schemas
// ============================================

export type CreateRankedSeasonInput = z.infer<typeof createRankedSeasonSchema>;
export type UpdateRankedSeasonInput = z.infer<typeof updateRankedSeasonSchema>;

export const createRankTierSchema = z.object({
  level: z.number().int().min(1),
  name: z.string().min(1).max(50),
  percentile: z.number().min(0).max(1),
  minMmr: z.number().int().min(0),
  subRanks: z.number().int().min(1).max(10).default(1),
  iconClass: z.string().min(1).max(100).optional().nullable(),
});

export const updateRankTierSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  percentile: z.number().min(0).max(1).optional(),
  minMmr: z.number().int().min(0).optional(),
  subRanks: z.number().int().min(1).max(10).optional(),
  iconClass: z.string().min(1).max(100).optional().nullable(),
});

export type CreateRankTierInput = z.infer<typeof createRankTierSchema>;
export type UpdateRankTierInput = z.infer<typeof updateRankTierSchema>;

// ============================================
// MMR Animation Events
// ============================================

export type MmrAnimationEventType = "provisional" | "official";
export type MmrAnimationEventReason = "match_finalized" | "match_cancelled" | "cascade" | "recalculated";

const animationPlayerRefSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  shortName: z.string(),
});

export const mmrAnimationEventResponseSchema = z
  .object({
    id: z.string(),
    matchId: z.string(),
    seasonId: z.string(),
    eventType: z.enum(["provisional", "official"]),
    reason: z.enum(["match_finalized", "match_cancelled", "cascade", "recalculated"]),
    mmrBefore: z.number(),
    mmrAfter: z.number(),
    mmrDelta: z.number(),
    // Points the recap shows/sums: full delta for a new match, differential for a
    // recalculated/cancelled one. Optional — legacy rows fall back to mmrDelta.
    displayDelta: z.number().optional(),
    tierBeforeLevel: z.number().int().nullable(),
    tierAfterLevel: z.number().int().nullable(),
    tierBeforeName: z.string().nullable(),
    tierAfterName: z.string().nullable(),
    rankChanged: z.boolean(),
    encouragementMessage: z.string().nullable(),
    createdAt: z.string(),
    playedAt: z.date().optional(),
    opponents: z.array(animationPlayerRefSchema).optional(),
    teammates: z.array(animationPlayerRefSchema).optional(),
  })
  .meta({ id: "MmrAnimationEvent" });

export type MmrAnimationEventResponse = z.infer<typeof mmrAnimationEventResponseSchema>;

/** Badge reveal queued for a player, parallel to the MMR animation events. */
export const badgeAnimationResponseSchema = z
  .object({
    id: z.string(),
    matchId: z.string().nullable(),
    seasonId: z.string(),
    icon: z.string(),
    label: z.string(),
    description: z.string(),
    createdAt: z.string(),
  })
  .meta({ id: "BadgeAnimation" });

export interface MmrAnimationWsPayload extends MmrAnimationEventResponse {
  tournamentId: string;
}

export type LeaderboardRecalculatingEvent = {
  event: 'leaderboard_recalculating';
  data: { seasonId: string };
};

export type LeaderboardUpdatedEvent = {
  event: 'leaderboard_updated';
  data: { seasonId: string };
};

// Sent once after a bulk MMR rebuild (forced recalc / cancellation cascade) to
// tell clients to refetch pending animations as a batch, so they surface as a
// single grouped recap instead of trickling in one-by-one.
export interface MmrRecapReadyPayload {
  seasonId: string;
  tournamentId: string;
}

export type MmrRecapReadyEvent = {
  event: 'mmr_recap_ready';
  data: MmrRecapReadyPayload;
};
