import { z } from "zod";
import {
  type MatchStatus,
  type MatchFinalizationReason,
  type MatchTeamSide,
  type TournamentStatus,
  matchStatusSchema,
  matchFinalizationReasonSchema,
} from "./enums";
import type { MatchSideModel, MatchResultModel } from "./entry";
import type { HistoryMatchSide } from "./ranked";

// ============================================
// Types and interfaces for matches
// ============================================

export interface Match {
  id: string;
  tournamentId: string;
  round?: number;
  teamAId?: string;
  teamBId?: string;
  scoreA: number;
  scoreB: number;
  winnerId?: string;
  winnerSide?: MatchTeamSide;
  status: MatchStatus;
  reportedBy?: string;
  reportedAt?: string;
  reportProof?: string;
  confirmationDeadline?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  finalizationReason?: MatchFinalizationReason;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
  outcomeType?: {
    id: string;
    disciplineId: string;
    name: string;
    discipline?: {
      id: string;
      name: string;
    };
  };
  outcomeReason?: {
    id: string;
    outcomeTypeId: string;
    name: string;
    outcomeType?: {
      id: string;
      disciplineId: string;
      name: string;
      discipline?: {
        id: string;
        name: string;
      };
    };
  };
  createdAt: string;
  updatedAt: string;
  playedAt: string;
}

/**
 * Match with relations - returned by list/getById endpoints
 */
export interface MatchModel extends Match {
  tournament?: {
    id: string;
    name: string;
    status: string;
    teamMode: string;
    mode: string;
    scoreEnabled?: boolean;
    validationMode?: string;
    validationTimerHours?: number | null;
  };
  teamA?: {
    id: string;
    name?: string;
    participants?: Array<{
      user?: {
        id: string;
        displayName: string;
      };
      effectivePointsAwarded?: number | null;
      exceededMatchLimit?: boolean;
    }>;
  };
  teamB?: {
    id: string;
    name?: string;
    participants?: Array<{
      user?: {
        id: string;
        displayName: string;
      };
      effectivePointsAwarded?: number | null;
      exceededMatchLimit?: boolean;
    }>;
  };
  winner?: {
    id: string;
    name?: string;
  };
  reporter?: {
    id: string;
    displayName: string;
  };
  finalizer?: {
    id: string;
    displayName: string;
  };
  participations?: Array<{
    id: string;
    matchId: string;
    playerId: string;
    teamSide: MatchTeamSide;
    player?: {
      id: string;
      displayName: string;
    };
  }>;
  confirmations?: MatchConfirmation[];

  // New entry-based fields (optional for backward compatibility)
  sides?: MatchSideModel[];
  result?: MatchResultModel;
}

export interface MatchParticipation {
  id: string;
  matchId: string;
  playerId: string;
  teamSide: MatchTeamSide;
}

export interface MatchConfirmation {
  id: string;
  matchId: string;
  playerId: string;
  isConfirmed: boolean;
  isContested: boolean;
  contestationReason?: string;
  createdAt: string;
  updatedAt: string;
  player?: {
    id: string;
    displayName: string;
  };
}

export interface MatchSideInput {
  position: number;
  playerIds?: string[];
  teamId?: string;
}

export interface CreateMatchInput {
  tournamentId: string;
  round?: number;
  sides?: MatchSideInput[];
  status?: MatchStatus;
  scoreA?: number | null;
  scoreB?: number | null;
  reportProof?: string;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
  winnerPosition?: number | null;
}

export interface UpdateMatchInput {
  round?: number;
  scoreA?: number | null;
  scoreB?: number | null;
  status?: MatchStatus;
  reportProof?: string;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
  winnerPosition?: number | null;
}

export interface ReportMatchResultInput {
  scoreA: number;
  scoreB: number;
  reportProof?: string;
  winnerPosition?: number | null;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ConfirmMatchInput {
  // Empty - just confirms the match result
}

export interface ContestMatchInput {
  contestationReason?: string;
}

export interface FinalizeMatchInput {
  finalizationReason: MatchFinalizationReason;
}

// ============================================
// Zod schemas for validation
// ============================================

export const matchSideInputSchema = z.object({
  position: z.number().int().min(1),
  playerIds: z.array(z.string().uuid()).optional(),
  teamId: z.string().uuid().optional(),
});

export const createMatchSchema = z.object({
  tournamentId: z.string().uuid("ID de tournoi invalide"),
  round: z.number().int().min(1).optional(),
  sides: z.array(matchSideInputSchema).min(2).optional(),
  status: matchStatusSchema.optional(),
  scoreA: z.number().int().min(0).nullable().optional(),
  scoreB: z.number().int().min(0).nullable().optional(),
  reportProof: z.string().optional(),
  outcomeTypeId: z.string().uuid("ID de type de résultat invalide").optional(),
  outcomeReasonId: z
    .string()
    .uuid("ID de raison de résultat invalide")
    .optional(),
  winnerPosition: z.number().int().min(1).nullable().optional(),
  playedAt: z.string().datetime().optional(),
});

export const updateMatchSchema = z.object({
  round: z.number().int().min(1).optional(),
  scoreA: z.number().int().min(0).nullable().optional(),
  scoreB: z.number().int().min(0).nullable().optional(),
  status: matchStatusSchema.optional(),
  reportProof: z.string().optional(),
  playedAt: z.string().datetime(),
  outcomeTypeId: z.string().uuid("ID de type de résultat invalide").optional(),
  outcomeReasonId: z
    .string()
    .uuid("ID de raison de résultat invalide")
    .optional(),
  winnerPosition: z.number().int().min(1).nullable().optional(),
});

export const reportMatchResultSchema = z.object({
  scoreA: z.number().int().min(0, "Le score doit être positif"),
  scoreB: z.number().int().min(0, "Le score doit être positif"),
  reportProof: z.string().optional(),
  winnerPosition: z.number().int().min(1).nullable().optional(),
  outcomeTypeId: z.string().uuid("ID de type de résultat invalide").optional(),
  outcomeReasonId: z
    .string()
    .uuid("ID de raison de résultat invalide")
    .optional(),
});

export const confirmMatchSchema = z.object({
  // Empty - just confirms the match result
});

export const contestMatchSchema = z.object({
  contestationReason: z.string().max(500).optional(),
});

export const respondToMatchSchema = z.object({
  type: z.enum(["agree", "dispute"]),
  reason: z.string().max(500).optional(),
});

export type RespondToMatchInput = z.infer<typeof respondToMatchSchema>;

export const finalizeMatchSchema = z.object({
  finalizationReason: matchFinalizationReasonSchema,
});

export const listMatchesQuerySchema = z.object({
  tournamentId: z.string().uuid().optional(),
  status: matchStatusSchema.optional(),
  round: z.number().int().min(1).optional(),
  playerId: z.string().uuid().optional(),
});

export const MATCH_MESSAGE_MAX_LENGTH = 1000;

export const postMatchMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Le message ne peut pas être vide")
    .max(MATCH_MESSAGE_MAX_LENGTH),
});

export type PostMatchMessageRequestData = z.infer<typeof postMatchMessageSchema>;

/**
 * A `user` message carries plain text in `body`. A `system` message carries an i18n
 * key in `body` plus its interpolation values in `translationParams`, so it renders
 * in the reader's language — same convention as notifications.
 */
export interface ClientMatchMessage {
  id: string;
  matchId: string;
  kind: "user" | "system";
  body: string;
  translationParams: Record<string, string | number | null> | null;
  createdAt: Date;
  author: { id: string; displayName: string } | null;
}

export const validateMatchSchema = z.object({
  tournamentId: z.string().uuid("ID de tournoi invalide"),
  round: z.number().int().min(1).optional(),
  sides: z.array(matchSideInputSchema).min(1).optional(),
  allPlayerIds: z.array(z.string().uuid()).optional(),
  matchId: z.string().uuid("ID de match invalide").optional(),
  playedAt: z.string().datetime().optional(),
});

export type ValidateMatchRequestData = z.infer<typeof validateMatchSchema>;

// ============================================
// Types inferred from schemas
// ============================================

export type CreateMatchRequestData = z.infer<typeof createMatchSchema>;
export type UpdateMatchRequestData = z.infer<typeof updateMatchSchema>;
export type ReportMatchResultRequestData = z.infer<
  typeof reportMatchResultSchema
>;
export type ConfirmMatchRequestData = z.infer<typeof confirmMatchSchema>;
export type ContestMatchRequestData = z.infer<typeof contestMatchSchema>;
export type FinalizeMatchRequestData = z.infer<typeof finalizeMatchSchema>;
export type RespondToMatchRequestData = z.infer<typeof respondToMatchSchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;

export const playerMatchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  tournamentId: z.string().uuid().optional(),
});

export type PlayerMatchHistoryQuery = z.infer<typeof playerMatchHistoryQuerySchema>;

// ============================================
// Types for the frontend (with Date dates instead of string)
// ============================================

/**
 * Type for Match on the frontend side - string dates are automatically
 * converted to Date objects by the xior interceptor
 */
export interface ClientMatch extends Omit<
  Match,
  | "createdAt"
  | "updatedAt"
  | "playedAt"
  | "reportedAt"
  | "confirmationDeadline"
  | "finalizedAt"
> {
  createdAt: Date;
  updatedAt: Date;
  playedAt: Date;
  reportedAt?: Date;
  confirmationDeadline?: Date;
  finalizedAt?: Date;
}

/**
 * Type for MatchModel on the frontend side - string dates are automatically
 * converted to Date objects by the xior interceptor
 */
export interface ClientMatchModel extends Omit<
  MatchModel,
  | "createdAt"
  | "updatedAt"
  | "playedAt"
  | "reportedAt"
  | "confirmationDeadline"
  | "finalizedAt"
  | "confirmations"
  | "result"
> {
  createdAt: Date;
  updatedAt: Date;
  playedAt: Date;
  reportedAt?: Date;
  confirmationDeadline?: Date;
  finalizedAt?: Date;
  confirmations?: ClientMatchConfirmation[];
  result?: {
    matchId: string;
    reportedBy?: string;
    reportedAt?: Date;
    reportProof?: string;
    finalizedBy?: string;
    finalizedAt?: Date;
    finalizationReason?: "consensus" | "auto_validation" | "admin_override";
    reporter?: {
      id: string;
      displayName: string;
    };
    finalizer?: {
      id: string;
      displayName: string;
    };
  };
}

/**
 * Type for MatchConfirmation on the frontend side - string dates are automatically
 * converted to Date objects by the xior interceptor
 */
export interface ClientMatchConfirmation extends Omit<
  MatchConfirmation,
  "createdAt" | "updatedAt"
> {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for CreateMatchRequestData on the frontend side
 * Dates can be Date objects (will be serialized to strings by JSON.stringify)
 */
export interface ClientCreateMatchRequest extends Omit<
  CreateMatchRequestData,
  "playedAt"
> {
  playedAt?: Date | string;
  sides?: MatchSideInput[];
}

/**
 * Type for UpdateMatchRequestData on the frontend side
 * Dates can be Date objects (will be serialized to strings by JSON.stringify)
 */
export interface ClientUpdateMatchRequest extends Omit<
  UpdateMatchRequestData,
  "playedAt"
> {
  playedAt?: Date | string;
}

/**
 * Type for ValidateMatchRequestData on the frontend side
 * Dates can be Date objects (will be serialized to strings by JSON.stringify)
 */
export interface ClientValidateMatchRequest extends Omit<
  ValidateMatchRequestData,
  "playedAt"
> {
  playedAt?: Date | string;
  sides?: MatchSideInput[];
}

/**
 * Unified match history entry for all tournament modes (ranked, championship, bracket).
 * For ranked matches, mmrDelta is populated. For other modes, it is null.
 * Dates are automatically converted to Date objects by the xior interceptor.
 */
export interface ClientMatchHistoryEntry {
  id: string;
  matchId: string;
  playerId: string;
  tournament: { id: string; name: string; mode: string; scoreEnabled: boolean };
  playedAt: Date;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerSide: "A" | "B" | null;
  teamSizeA: number;
  teamSizeB: number;
  sides: HistoryMatchSide[];
  mmrDelta: number | null;
  outcomeType?: { id: string; name: string } | null;
}

/**
 * Lean match card type for the unified GET /matches endpoint.
 * Scores and team sizes are derivable from sides (side.score, side.players.length).
 * winnerSide is represented as side.isWinner to avoid redundancy.
 */
export interface MatchCardSide {
  position: number;
  score: number | null;
  isWinner: boolean;
  players: { id: string; displayName: string; shortName: string }[];
}

export interface ClientMatchCard {
  id: string;
  playedAt: Date;
  status: string;
  tournament: { id: string; name: string; mode: string; scoreEnabled: boolean };
  sides: MatchCardSide[];
  outcomeType: { id: string; name: string } | null;
  playerId?: string;
  mmrDelta?: number | null;
  pointsDelta?: number | null;
}

export interface PaginatedMatchCards {
  data: ClientMatchCard[];
  total: number;
  hasMore: boolean;
}

export interface MatchDetailPlayer {
  id: string;
  displayName: string;
  shortName: string;
  effectivePointsAwarded?: number;
  exceededMatchLimit?: boolean;
  mmrDelta?: number | null;
}

export interface MatchDetailSide {
  position: number;
  score: number | null;
  pointsAwarded: number;
  isWinner: boolean;
  entryId: string;
  entryName: string | null;
  teamId: string | null;
  players: MatchDetailPlayer[];
}

export interface MatchDetailConfirmation {
  id: string;
  matchId: string;
  playerId: string;
  isConfirmed: boolean;
  isContested: boolean;
  contestationReason: string | null;
  sidePosition: number | null;
  isPostFinalization: boolean;
  createdAt: Date;
  updatedAt: Date;
  player: { id: string; displayName: string } | null;
}

export interface ClientMatchDetail {
  id: string;
  tournamentId: string;
  status: MatchStatus;
  playedAt: Date;
  confirmationDeadline?: Date;
  createdAt: Date;
  createdBy?: string;
  creator?: { id: string; displayName: string };
  outcomeTypeId?: string;
  outcomeReasonId?: string | null;
  tournament?: {
    id: string;
    name: string;
    mode: string;
    teamMode: string;
    scoreEnabled: boolean;
    validationMode?: string;
    validationTimerHours?: number | null;
    status: TournamentStatus;
  };
  outcomeType?: { id: string; name: string } | null;
  outcomeReason?: { id: string; name: string } | null;
  confirmations?: MatchDetailConfirmation[];
  sides: MatchDetailSide[];
  result?: {
    reportedBy?: string;
    reportedAt?: Date;
    reportProof?: string;
    finalizedBy?: string;
    finalizedAt?: Date;
    finalizationReason?: MatchFinalizationReason;
    reporter?: { id: string; displayName: string };
  };
}

export const listMatchCardsQuerySchema = z.object({
  tournamentId: z.string().uuid().optional(),
  playerIds: z.string().optional(),
  status: matchStatusSchema.optional(),
  bracketMode: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListMatchCardsQuery = z.infer<typeof listMatchCardsQuerySchema>;
