import { z } from "zod";

// ============================================
// Types et interfaces pour les règles du jeu
// ============================================

export interface GameRule {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientGameRule extends Omit<GameRule, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Schémas Zod
// ============================================

export const createGameRuleSchema = z.object({
  title: z
    .string({ message: "Le titre est requis" })
    .min(2, "Le titre doit contenir au moins 2 caractères")
    .max(200, "Le titre ne peut pas dépasser 200 caractères"),
  content: z.string({ message: "Le contenu est requis" }).min(1, "Le contenu est requis"),
});

export const updateGameRuleSchema = z.object({
  title: z
    .string()
    .min(2, "Le titre doit contenir au moins 2 caractères")
    .max(200, "Le titre ne peut pas dépasser 200 caractères")
    .optional(),
  content: z.string().min(1, "Le contenu est requis").optional(),
});

// ============================================
// Types inférés
// ============================================

export type CreateGameRuleData = z.infer<typeof createGameRuleSchema>;
export type UpdateGameRuleData = z.infer<typeof updateGameRuleSchema>;
