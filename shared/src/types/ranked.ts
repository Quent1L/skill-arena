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
// Types et interfaces pour le mode Ranked
// ============================================

export interface RankedSeasonConfig {
  id: string;
  tournamentId: string;
  baseMmr: number;
  kFactor: number;
  placementMatches: number;
  usePreviousMmr: boolean;
  allowAsymmetricMatches: boolean;
  sourceTierSeasonId?: string | null;
}

export interface PlayerMmr {
  id: string;
  seasonId: string;
  playerId: string;
  currentMmr: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winStreak: number;
  maxWinStreak: number;
  lossStreak: number;
  maxLossStreak: number;
}

export type MmrHistoryOutcome = 'win' | 'loss' | 'draw';

export interface MmrChartPoint {
  mmrAfter: number;
  mmrDelta: number;
  outcome?: MmrHistoryOutcome | null;
  playedAt: Date;
}

export interface MmrHistoryEntry {
  id: string;
  seasonId: string;
  playerId: string;
  matchId: string;
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  kEffective: number;
  opponentAvgMmr: number;
  isPlacement: boolean;
  outcome?: MmrHistoryOutcome | null;
}

export interface ClientRankTier {
  id: string;
  seasonId: string;
  level: number;
  name: string;
  percentile: number;
  minMmr: number;
  subRanks: number;
  iconClass?: string | null;
  calculatedAt: Date;
}

// ============================================
// Types client (dates converties en Date)
// ============================================

export interface OpponentQualityBucket {
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winRate: number;
}

export interface OpponentQualityStats {
  vsStronger: OpponentQualityBucket;
  vsEqual: OpponentQualityBucket;
  vsWeaker: OpponentQualityBucket;
}

export interface ClientPlayerMmr extends PlayerMmr {
  player?: {
    id: string;
    displayName: string;
    shortName: string;
  };
  recentResults?: { outcome: 'win' | 'loss' | 'draw' }[];
  opponentQuality?: OpponentQualityStats;
}

export interface HistoryMatchSidePlayer {
  id: string;
  displayName: string;
  shortName: string;
}

export interface HistoryMatchSide {
  position: number;
  players: HistoryMatchSidePlayer[];
}

export interface ClientMmrHistoryEntry extends Omit<MmrHistoryEntry, "id"> {
  id: string;
  match?: {
    id: string;
    playedAt: Date;
    status: string;
  };
  teamSizeA?: number | null;
  teamSizeB?: number | null;
  sides?: HistoryMatchSide[];
}

// ============================================
// Schémas Zod pour la validation
// ============================================

// ============================================
// Schémas pour le formulaire (frontend, dates en Date)
// ============================================
// Étend baseSeasonFormSchema (champs communs avec les tournois) en ajoutant
// les champs spécifiques aux saisons ranked (config MMR).
const rankedSeasonExtraFields = {
  baseMmr: z.number().int().min(100).max(5000),
  kFactor: z.number().int().min(8).max(128),
  placementMatches: z.number().int().min(0).max(20),
  usePreviousMmr: z.boolean(),
  allowAsymmetricMatches: z.boolean(),
  sourceTierSeasonId: z.string().uuid().nullable().optional(),
};

export const baseRankedSeasonFormSchema =
  baseSeasonFormSchema.extend(rankedSeasonExtraFields);

export const baseRankedSeasonUpdateFormSchema =
  baseSeasonUpdateFormSchema.extend({
    baseMmr: z.number().int().min(100).max(5000).optional(),
    kFactor: z.number().int().min(8).max(128).optional(),
    placementMatches: z.number().int().min(0).max(20).optional(),
    usePreviousMmr: z.boolean().optional(),
    allowAsymmetricMatches: z.boolean().optional(),
    sourceTierSeasonId: z.string().uuid().nullable().optional(),
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
// Schémas pour l'API (backend, dates en string)
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
  allowAsymmetricMatches: z.boolean().optional(),
  sourceTierSeasonId: z.string().uuid().nullable().optional(),
  validationMode: validationModeSchema.optional(),
  validationTimerHours: z.number().int().min(1).max(168).nullable().optional(),
});

// ============================================
// Types inférés des schémas
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

export interface MmrAnimationEventResponse {
  id: string;
  matchId: string;
  seasonId: string;
  eventType: MmrAnimationEventType;
  reason: MmrAnimationEventReason;
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  // Points the recap shows/sums: full delta for a new match, differential for a
  // recalculated/cancelled one. Optional — legacy rows fall back to mmrDelta.
  displayDelta?: number;
  tierBeforeLevel: number | null;
  tierAfterLevel: number | null;
  tierBeforeName: string | null;
  tierAfterName: string | null;
  rankChanged: boolean;
  encouragementMessage: string | null;
  createdAt: string;
  playedAt?: Date;
  opponents?: { id: string; displayName: string; shortName: string }[];
  teammates?: { id: string; displayName: string; shortName: string }[];
}

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
