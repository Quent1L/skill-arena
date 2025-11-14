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
  createdAt: string;
  updatedAt: string;
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
});

export const updateMatchSchema = z.object({
  round: z.number().int().min(1).optional(),
  scoreA: z.number().int().min(0).optional(),
  scoreB: z.number().int().min(0).optional(),
  status: matchStatusSchema.optional(),
  reportProof: z.string().optional(),
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
