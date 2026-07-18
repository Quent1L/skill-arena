import { z } from "zod";

// ============================================
// Types and interfaces for disciplines
// ============================================

export type TeamInteractionMode = 'INDIVIDUAL' | 'SHARED_RESOURCE' | 'COLLABORATIVE';

export const TEAM_INTERACTION_MODES = ['INDIVIDUAL', 'SHARED_RESOURCE', 'COLLABORATIVE'] as const;

export interface Discipline {
  id: string;
  name: string;
  icon?: string | null;
  scoreInstructions?: string | null;
  teamInteractionMode?: TeamInteractionMode | null;
}

export interface CreateDisciplineInput {
  name: string;
  icon?: string | null;
  scoreInstructions?: string | null;
  teamInteractionMode?: TeamInteractionMode | null;
}

export interface UpdateDisciplineInput {
  name?: string;
  icon?: string | null;
  scoreInstructions?: string | null;
  teamInteractionMode?: TeamInteractionMode | null;
}

// ============================================
// Zod schemas for validation
// ============================================

export const createDisciplineSchema = z.object({
  name: z
    .string({ message: "Le nom est requis" })
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  icon: z.string().nullish(),
  scoreInstructions: z.string().max(500).nullish(),
  teamInteractionMode: z.enum(TEAM_INTERACTION_MODES).nullish(),
});

export const updateDisciplineSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
  icon: z.string().nullish(),
  scoreInstructions: z.string().max(500).nullish(),
  teamInteractionMode: z.enum(TEAM_INTERACTION_MODES).nullish(),
});

// ============================================
// Types inferred from schemas
// ============================================

export type CreateDisciplineRequestData = z.infer<
  typeof createDisciplineSchema
>;
export type UpdateDisciplineRequestData = z.infer<
  typeof updateDisciplineSchema
>;


