import { z } from "zod";
import { type MatchStatus, matchStatusSchema } from "./enums";

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
  status: MatchStatus;
  reportedBy?: string;
  reportedAt?: string;
  confirmationBy?: string;
  confirmationAt?: string;
  reportProof?: string;
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
  participations?: Array<{
    id: string;
    matchId: string;
    playerId: string;
    teamSide: "A" | "B";
    player?: {
      id: string;
      displayName: string;
    };
  }>;
}

export interface MatchParticipation {
  id: string;
  matchId: string;
  playerId: string;
  teamSide: "A" | "B";
}

export interface CreateMatchInput {
  tournamentId: string;
  round?: number;
  teamAId?: string;
  teamBId?: string;
  playerIdsA?: string[]; // For flex team mode
  playerIdsB?: string[]; // For flex team mode
  status?: MatchStatus;
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

export interface ConfirmMatchResultInput {
  confirmed: boolean;
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

export const confirmMatchResultSchema = z.object({
  confirmed: z.boolean(),
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
export type ConfirmMatchResultRequestData = z.infer<
  typeof confirmMatchResultSchema
>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;

// ============================================
// Types pour le frontend (avec dates en Date au lieu de string)
// ============================================

/**
 * Type pour Match côté frontend - les dates string sont automatiquement
 * converties en objets Date par l'intercepteur xior
 */
export interface ClientMatch extends Omit<Match, 'createdAt' | 'updatedAt' | 'playedAt' | 'reportedAt' | 'confirmationAt'> {
  createdAt: Date;
  updatedAt: Date;
  playedAt: Date;
  reportedAt?: Date;
  confirmationAt?: Date;
}

/**
 * Type pour MatchModel côté frontend - les dates string sont automatiquement
 * converties en objets Date par l'intercepteur xior
 */
export interface ClientMatchModel extends Omit<MatchModel, 'createdAt' | 'updatedAt' | 'playedAt' | 'reportedAt' | 'confirmationAt'> {
  createdAt: Date;
  updatedAt: Date;
  playedAt: Date;
  reportedAt?: Date;
  confirmationAt?: Date;
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
