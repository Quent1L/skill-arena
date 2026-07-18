import { z } from "zod";
import type { Discipline } from "./discipline";

// ============================================
// Types and interfaces for outcome types
// ============================================

export interface OutcomeType {
  id: string;
  disciplineId: string;
  name: string;
  isDefault: boolean;
  scoreCountsForMmr: boolean;
  points: number;
  mmrMultiplier: number;
  discipline?: Discipline | null;
}

export interface VictoryQualityDetail {
  outcomeTypeName: string;
  points: number;
  wins: number;
  losses: number;
  contribution: number;
}

export interface CreateOutcomeTypeInput {
  disciplineId: string;
  name: string;
  isDefault?: boolean;
  scoreCountsForMmr?: boolean;
  points?: number;
  mmrMultiplier?: number;
}

export interface UpdateOutcomeTypeInput {
  disciplineId?: string;
  name?: string;
  isDefault?: boolean;
  scoreCountsForMmr?: boolean;
  points?: number;
  mmrMultiplier?: number;
}

// ============================================
// Zod schemas for validation
// ============================================

export const createOutcomeTypeSchema = z.object({
  disciplineId: z.string().uuid("ID de discipline invalide"),
  name: z
    .string({ message: "Le nom est requis" })
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  isDefault: z.boolean().optional(),
  scoreCountsForMmr: z.boolean().optional(),
  points: z.number().int().min(0).default(3),
  mmrMultiplier: z.number().positive().default(1),
});

export const updateOutcomeTypeSchema = z.object({
  disciplineId: z.string().uuid("ID de discipline invalide").optional(),
  name: z
    .string()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
  isDefault: z.boolean().optional(),
  scoreCountsForMmr: z.boolean().optional(),
  points: z.number().int().min(0).optional(),
  mmrMultiplier: z.number().positive().optional(),
});

// ============================================
// Types inferred from schemas
// ============================================

export type CreateOutcomeTypeRequestData = z.infer<
  typeof createOutcomeTypeSchema
>;
export type UpdateOutcomeTypeRequestData = z.infer<
  typeof updateOutcomeTypeSchema
>;


