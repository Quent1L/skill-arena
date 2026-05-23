import { z } from "zod";
import type { Discipline } from "./discipline";

// ============================================
// Types et interfaces pour les types de résultat
// ============================================

export interface OutcomeType {
  id: string;
  disciplineId: string;
  name: string;
  isDefault: boolean;
  scoreCountsForMmr: boolean;
  points: number;
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
}

export interface UpdateOutcomeTypeInput {
  disciplineId?: string;
  name?: string;
  isDefault?: boolean;
  scoreCountsForMmr?: boolean;
  points?: number;
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
  isDefault: z.boolean().optional(),
  scoreCountsForMmr: z.boolean().optional(),
  points: z.number().int().min(0).default(3),
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


