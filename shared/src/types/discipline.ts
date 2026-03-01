import { z } from "zod";

// ============================================
// Types et interfaces pour les disciplines
// ============================================

export interface Discipline {
  id: string;
  name: string;
  scoreInstructions?: string | null;
}

export interface CreateDisciplineInput {
  name: string;
  scoreInstructions?: string | null;
}

export interface UpdateDisciplineInput {
  name?: string;
  scoreInstructions?: string | null;
}

// ============================================
// Schémas Zod pour la validation
// ============================================

export const createDisciplineSchema = z.object({
  name: z
    .string({ message: "Le nom est requis" })
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  scoreInstructions: z.string().max(500).nullish(),
});

export const updateDisciplineSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
  scoreInstructions: z.string().max(500).nullish(),
});

// ============================================
// Types inférés des schémas
// ============================================

export type CreateDisciplineRequestData = z.infer<
  typeof createDisciplineSchema
>;
export type UpdateDisciplineRequestData = z.infer<
  typeof updateDisciplineSchema
>;


