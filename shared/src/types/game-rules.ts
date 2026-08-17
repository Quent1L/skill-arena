import { z } from "zod";

// ============================================
// Types and interfaces for game rules
// ============================================

// Timestamps are strings: this describes the wire shape, where c.json() has already
// serialised the Date instances the service works with. ClientGameRule below is the
// same payload after the frontend interceptor has revived them.
export const gameRuleSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    createdBy: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "GameRule" });

export type GameRule = z.infer<typeof gameRuleSchema>;

export const gameRuleListSchema = z.array(gameRuleSchema);

export interface ClientGameRule extends Omit<GameRule, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Zod schemas
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
// Inferred types
// ============================================

export type CreateGameRuleData = z.infer<typeof createGameRuleSchema>;
export type UpdateGameRuleData = z.infer<typeof updateGameRuleSchema>;
