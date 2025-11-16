import { z } from "zod";

// ============================================
// Types et interfaces pour les disciplines
// ============================================

export interface Discipline {
  id: string;
  name: string;
}

export interface CreateDisciplineInput {
  name: string;
}

export interface UpdateDisciplineInput {
  name?: string;
}

// ============================================
// Schémas Zod pour la validation
// ============================================

export const createDisciplineSchema = z.object({
  name: z
    .string({ message: "Le nom est requis" })
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
});

export const updateDisciplineSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
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


