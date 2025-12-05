import { z } from "zod";
import { 
  type MatchStatus, 
  type MatchFinalizationReason,
  type MatchTeamSide,
  matchStatusSchema,
  matchFinalizationReasonSchema,
  matchTeamSideSchema,
} from "./enums";

// ============================================
// Types et interfaces pour les matchs
// ============================================

export type BracketType = 'winner' | 'loser' | 'grand_final';

export interface Match {
  id: string;
  tournamentId: string;
  round?: number;
  sequence?: number;
  bracketType?: BracketType;
  matchPosition?: number;
  nextMatchWinId?: string;
  nextMatchLoseId?: string;
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
  };
  teamA?: {
    id: string;
    name?: string;
    participants?: Array<{
      user?: {
        id: string;
        displayName: string;
      };
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
  scoreA?: number;
  scoreB?: number;
  reportProof?: string;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
  winner?: 'teamA' | 'teamB' | null; // Explicit winner selection (overrides score-based calculation)
}

export interface UpdateMatchInput {
  round?: number;
  scoreA?: number;
  scoreB?: number;
  status?: MatchStatus;
  reportProof?: string;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
}

export interface ReportMatchResultInput {
  scoreA: number;
  scoreB: number;
  reportProof?: string;
}

export interface ConfirmMatchInput {
  // Empty - just confirms the match result
}

export interface ContestMatchInput {
  contestationReason?: string;
  contestationProof?: string;
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
  scoreA: z.number().int().min(0).optional(),
  scoreB: z.number().int().min(0).optional(),
  reportProof: z.string().optional(),
  outcomeTypeId: z.string().uuid("ID de type de résultat invalide").optional(),
  outcomeReasonId: z.string().uuid("ID de raison de résultat invalide").optional(),
  winner: z.enum(['teamA', 'teamB']).nullable().optional(),
  playedAt: z.iso.datetime().optional()
});

export const updateMatchSchema = z.object({
  round: z.number().int().min(1).optional(),
  scoreA: z.number().int().min(0).optional(),
  scoreB: z.number().int().min(0).optional(),
  status: matchStatusSchema.optional(),
  reportProof: z.string().optional(),
  playedAt: z.iso.datetime(),
  outcomeTypeId: z.string().uuid("ID de type de résultat invalide").optional(),
  outcomeReasonId: z
    .string()
    .uuid("ID de raison de résultat invalide")
    .optional(),
});

export const reportMatchResultSchema = z.object({
  scoreA: z.number().int().min(0, "Le score doit être positif"),
  scoreB: z.number().int().min(0, "Le score doit être positif"),
  reportProof: z.string().optional(),
});

export const confirmMatchSchema = z.object({
  // Empty - just confirms the match result
});

export const contestMatchSchema = z.object({
  contestationReason: z.string().optional(),
  contestationProof: z.string().optional(),
});

export const finalizeMatchSchema = z.object({
  finalizationReason: matchFinalizationReasonSchema,
});

export const listMatchesQuerySchema = z.object({
  tournamentId: z.string().uuid().optional(),
  status: matchStatusSchema.optional(),
  round: z.number().int().min(1).optional(),
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
    playedAt: z.iso.datetime().optional(),
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
    }
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

// ============================================
// Types pour le frontend (avec dates en Date au lieu de string)
// ============================================

/**
 * Type pour Match côté frontend - les dates string sont automatiquement
 * converties en objets Date par l'intercepteur xior
 */
export interface ClientMatch extends Omit<Match, 'createdAt' | 'updatedAt' | 'playedAt' | 'reportedAt' | 'confirmationDeadline' | 'finalizedAt'> {
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
export interface ClientMatchModel extends Omit<MatchModel, 'createdAt' | 'updatedAt' | 'playedAt' | 'reportedAt' | 'confirmationDeadline' | 'finalizedAt' | 'confirmations'> {
  createdAt: Date;
  updatedAt: Date;
  playedAt: Date;
  reportedAt?: Date;
  confirmationDeadline?: Date;
  finalizedAt?: Date;
  confirmations?: ClientMatchConfirmation[];
}

/**
 * Type pour MatchConfirmation côté frontend - les dates string sont automatiquement
 * converties en objets Date par l'intercepteur xior
 */
export interface ClientMatchConfirmation extends Omit<MatchConfirmation, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type pour CreateMatchRequestData côté frontend
 * Les dates peuvent être des objets Date (seront sérialisées en string par JSON.stringify)
 */
export interface ClientCreateMatchRequest extends Omit<CreateMatchRequestData, 'playedAt'> {
  playedAt?: Date | string;
}

/**
 * Type pour UpdateMatchRequestData côté frontend
 * Les dates peuvent être des objets Date (seront sérialisées en string par JSON.stringify)
 */
export interface ClientUpdateMatchRequest extends Omit<UpdateMatchRequestData, 'playedAt'> {
  playedAt?: Date | string;
}

/**
 * Type pour ValidateMatchRequestData côté frontend
 * Les dates peuvent être des objets Date (seront sérialisées en string par JSON.stringify)
 */
export interface ClientValidateMatchRequest extends Omit<ValidateMatchRequestData, 'playedAt'> {
  playedAt?: Date | string;
}
