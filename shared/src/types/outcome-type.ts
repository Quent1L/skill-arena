import { z } from "zod";

// ============================================
// Types et interfaces pour les types de résultat
// ============================================

export interface OutcomeType {
  id: string;
  disciplineId: string;
  name: string;
  discipline?: {
    id: string;
    name: string;
  };
}

export interface CreateOutcomeTypeInput {
  disciplineId: string;
  name: string;
}

export interface UpdateOutcomeTypeInput {
  disciplineId?: string;
  name?: string;
}

// ============================================
// Schémas Zod pour la validation
// ============================================

export const createOutcomeTypeSchema = z.object({
  disciplineId: z.string().uuid("ID de discipline invalide"),
  name: z
    .string({ message: "Le nom est requis" })
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
});

export const updateOutcomeTypeSchema = z.object({
  disciplineId: z.string().uuid("ID de discipline invalide").optional(),
  name: z
    .string()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
});

// ============================================
// Types inférés des schémas
// ============================================

export type CreateOutcomeTypeRequestData = z.infer<
  typeof createOutcomeTypeSchema
>;
export type UpdateOutcomeTypeRequestData = z.infer<
  typeof updateOutcomeTypeSchema
>;


