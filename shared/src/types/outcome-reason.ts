import { z } from "zod";

// ============================================
// Types et interfaces pour les raisons de résultat
// ============================================

export interface OutcomeReason {
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
}

export interface CreateOutcomeReasonInput {
  outcomeTypeId: string;
  name: string;
}

export interface UpdateOutcomeReasonInput {
  outcomeTypeId?: string;
  name?: string;
}

// ============================================
// Schémas Zod pour la validation
// ============================================

export const createOutcomeReasonSchema = z.object({
  outcomeTypeId: z.uuid("ID de type de résultat invalide"),
  name: z
    .string({ message: "Le nom est requis" })
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
});

export const updateOutcomeReasonSchema = z.object({
  outcomeTypeId: z.uuid("ID de type de résultat invalide").optional(),
  name: z
    .string()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
});

// ============================================
// Types inférés des schémas
// ============================================

export type CreateOutcomeReasonRequestData = z.infer<
  typeof createOutcomeReasonSchema
>;
export type UpdateOutcomeReasonRequestData = z.infer<
  typeof updateOutcomeReasonSchema
>;


