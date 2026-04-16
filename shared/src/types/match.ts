import { z } from "zod";
import {
  type MatchStatus,
  type MatchFinalizationReason,
  type MatchTeamSide,
  matchStatusSchema,
  matchFinalizationReasonSchema,
} from "./enums";
import type { MatchSideModel, MatchResultModel } from "./entry";
import type { HistoryMatchSide } from "./ranked";

// ============================================
// Types et interfaces pour les matchs
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
  contestationProof?: string;
  proposedScoreA?: number | null;
  proposedScoreB?: number | null;
  proposedWinner?: "teamA" | "teamB" | null;
  proposedOutcomeTypeId?: string | null;
  proposedOutcomeReasonId?: string | null;
  proposedOutcomeType?: { id: string; name: string } | null;
  proposedOutcomeReason?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  player?: {
    id: string;
    displayName: string;
  };
}

export interface CreateMatchInput {
  tournamentId: string;
  round?: number;
  teamAId?: string;
  teamBId?: string;
  playerIdsA?: string[]; // For flex team mode
  playerIdsB?: string[]; // For flex team mode
  status?: MatchStatus;
  scoreA?: number | null;
  scoreB?: number | null;
  reportProof?: string;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
  winner?: "teamA" | "teamB" | null; // Explicit winner selection (overrides score-based calculation)
}

export interface UpdateMatchInput {
  round?: number;
  scoreA?: number | null;
  scoreB?: number | null;
  status?: MatchStatus;
  reportProof?: string;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
  winner?: "teamA" | "teamB" | null;
}

export interface ReportMatchResultInput {
  scoreA: number;
  scoreB: number;
  reportProof?: string;
  winner?: "teamA" | "teamB" | null;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
}

export interface ConfirmMatchInput {
  // Empty - just confirms the match result
}

export interface ContestMatchInput {
  contestationReason?: string;
  contestationProof?: string;
  proposedScoreA?: number;
  proposedScoreB?: number;
  proposedWinner?: "teamA" | "teamB" | null;
  proposedOutcomeTypeId?: string;
  proposedOutcomeReasonId?: string;
}

export interface FinalizeMatchInput {
  finalizationReason: MatchFinalizationReason;
}

// ============================================
// Schémas Zod pour la validation
// ============================================

export const createMatchSchema = z.object({
  tournamentId: z.string().uuid("ID de tournoi invalide"),
  round: z.number().int().min(1).optional(),
  teamAId: z.string().uuid("ID d'équipe A invalide").optional(),
  teamBId: z.string().uuid("ID d'équipe B invalide").optional(),
  playerIdsA: z.array(z.string().uuid()).optional(),
  playerIdsB: z.array(z.string().uuid()).optional(),
  status: matchStatusSchema.optional(),
  scoreA: z.number().int().min(0).nullable().optional(),
  scoreB: z.number().int().min(0).nullable().optional(),
  reportProof: z.string().optional(),
  outcomeTypeId: z.string().uuid("ID de type de résultat invalide").optional(),
  outcomeReasonId: z
    .string()
    .uuid("ID de raison de résultat invalide")
    .optional(),
  winner: z.enum(["teamA", "teamB"]).nullable().optional(),
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
  winner: z.enum(["teamA", "teamB"]).nullable().optional(),
});

export const reportMatchResultSchema = z.object({
  scoreA: z.number().int().min(0, "Le score doit être positif"),
  scoreB: z.number().int().min(0, "Le score doit être positif"),
  reportProof: z.string().optional(),
  winner: z.enum(["teamA", "teamB"]).nullable().optional(),
  outcomeTypeId: z.string().uuid("ID de type de résultat invalide").optional(),
  outcomeReasonId: z
    .string()
    .uuid("ID de raison de résultat invalide")
    .optional(),
});

export const confirmMatchSchema = z.object({
  // Empty - just confirms the match result
});

export const contestMatchSchema = z
  .object({
    contestationReason: z.string().optional(),
    contestationProof: z.string().optional(),
    proposedScoreA: z.number().int().min(0).optional(),
    proposedScoreB: z.number().int().min(0).optional(),
    proposedWinner: z.enum(["teamA", "teamB"]).nullable().optional(),
    proposedOutcomeTypeId: z
      .string()
      .uuid("ID de type de résultat invalide")
      .optional(),
    proposedOutcomeReasonId: z
      .string()
      .uuid("ID de raison de résultat invalide")
      .optional(),
  })
  .refine(
    (data) => {
      const hasA = data.proposedScoreA !== undefined;
      const hasB = data.proposedScoreB !== undefined;
      return hasA === hasB; // both or neither
    },
    {
      message: "proposedScoreA et proposedScoreB doivent être fournis ensemble",
    },
  );

export const finalizeMatchSchema = z.object({
  finalizationReason: matchFinalizationReasonSchema,
});

export const listMatchesQuerySchema = z.object({
  tournamentId: z.string().uuid().optional(),
  status: matchStatusSchema.optional(),
  round: z.number().int().min(1).optional(),
  playerId: z.string().uuid().optional(),
});

export const validateMatchSchema = z
  .object({
    tournamentId: z.string().uuid("ID de tournoi invalide"),
    round: z.number().int().min(1).optional(),
    teamAId: z.string().uuid("ID d'équipe A invalide").optional(),
    teamBId: z.string().uuid("ID d'équipe B invalide").optional(),
    playerIdsA: z.array(z.string().uuid()).optional(),
    playerIdsB: z.array(z.string().uuid()).optional(),
    matchId: z.string().uuid("ID de match invalide").optional(), // Match ID to exclude from validation (for edit mode)
    playedAt: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      // Au moins tournamentId doit être fourni
      if (!data.tournamentId) {
        return false;
      }

      // Si teamAId est fourni, on peut valider partiellement
      // Si playerIdsA est fourni, on peut valider partiellement
      // L'important c'est que tournamentId soit là
      return true;
    },
    {
      message: "tournamentId est requis pour la validation",
    },
  );

export type ValidateMatchRequestData = z.infer<typeof validateMatchSchema>;

// ============================================
// Types inférés des schémas
// ============================================

export type CreateMatchRequestData = z.infer<typeof createMatchSchema>;
export type UpdateMatchRequestData = z.infer<typeof updateMatchSchema>;
export type ReportMatchResultRequestData = z.infer<
  typeof reportMatchResultSchema
>;
export type ConfirmMatchRequestData = z.infer<typeof confirmMatchSchema>;
export type ContestMatchRequestData = z.infer<typeof contestMatchSchema>;
export type FinalizeMatchRequestData = z.infer<typeof finalizeMatchSchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;

export const playerMatchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  tournamentId: z.string().uuid().optional(),
});

export type PlayerMatchHistoryQuery = z.infer<typeof playerMatchHistoryQuerySchema>;

// ============================================
// Types pour le frontend (avec dates en Date au lieu de string)
// ============================================

/**
 * Type pour Match côté frontend - les dates string sont automatiquement
 * converties en objets Date par l'intercepteur xior
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
 * Type pour MatchModel côté frontend - les dates string sont automatiquement
 * converties en objets Date par l'intercepteur xior
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
 * Type pour MatchConfirmation côté frontend - les dates string sont automatiquement
 * converties en objets Date par l'intercepteur xior
 */
export interface ClientMatchConfirmation extends Omit<
  MatchConfirmation,
  "createdAt" | "updatedAt"
> {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type pour CreateMatchRequestData côté frontend
 * Les dates peuvent être des objets Date (seront sérialisées en string par JSON.stringify)
 */
export interface ClientCreateMatchRequest extends Omit<
  CreateMatchRequestData,
  "playedAt"
> {
  playedAt?: Date | string;
}

/**
 * Type pour UpdateMatchRequestData côté frontend
 * Les dates peuvent être des objets Date (seront sérialisées en string par JSON.stringify)
 */
export interface ClientUpdateMatchRequest extends Omit<
  UpdateMatchRequestData,
  "playedAt"
> {
  playedAt?: Date | string;
}

/**
 * Type pour ValidateMatchRequestData côté frontend
 * Les dates peuvent être des objets Date (seront sérialisées en string par JSON.stringify)
 */
export interface ClientValidateMatchRequest extends Omit<
  ValidateMatchRequestData,
  "playedAt"
> {
  playedAt?: Date | string;
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
}

export interface PaginatedMatchCards {
  data: ClientMatchCard[];
  total: number;
  hasMore: boolean;
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
