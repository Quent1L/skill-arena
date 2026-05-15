import { z } from "zod";
import { validationModeSchema } from "./enums";

// ============================================
// Schéma de base partagé entre tournois et saisons ranked
// ============================================
// Une saison ranked est un tournoi (mode='ranked') avec une config MMR additionnelle.
// Ces deux entités partagent le même bloc de champs "informations générales" et
// "contraintes de score". Ce schéma factorise ces champs communs (côté formulaire,
// donc avec des objets Date plutôt que des strings ISO).

export const baseSeasonFormSchema = z.object({
  name: z
    .string({ message: "Le nom est requis" })
    .min(3, "Le nom doit contenir au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  description: z.string().optional(),
  disciplineId: z
    .string({ message: "La discipline est requise" })
    .uuid("ID de discipline invalide"),
  startDate: z.date({ message: "La date de début est requise" }),
  endDate: z.date({ message: "La date de fin est requise" }),
  minTeamSize: z
    .number({ message: "La taille minimale de l'équipe est requise" })
    .int()
    .min(1, "La taille minimale est 1"),
  maxTeamSize: z
    .number({ message: "La taille maximale de l'équipe est requise" })
    .int()
    .min(1, "La taille minimale est 1"),
  rulesId: z.string().uuid().nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  scoreEnabled: z.boolean().optional(),
  minScore: z.number().int().min(0).nullable().optional(),
  maxScore: z.number().int().min(0).nullable().optional(),
  allowDraw: z.boolean().optional(),
  validationMode: validationModeSchema.optional(),
  validationTimerHours: z.number().int().min(1).max(168).nullable().optional(),
});

export const baseSeasonUpdateFormSchema = baseSeasonFormSchema.partial();

export type BaseSeasonFormData = z.infer<typeof baseSeasonFormSchema>;
export type BaseSeasonUpdateFormData = z.infer<
  typeof baseSeasonUpdateFormSchema
>;

// ============================================
// Prédicats partagés pour la validation cross-field
// ============================================
// Utilisés via `.refine(predicate, options)` dans les schemas dérivés.
// On expose les prédicats plutôt que des wrappers de schémas pour éviter
// les complications de typage de ZodEffects.

export const dateRangePredicate = (data: {
  startDate?: Date | string;
  endDate?: Date | string;
}): boolean => {
  if (!data.startDate || !data.endDate) return true;
  const start =
    data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
  const end =
    data.endDate instanceof Date ? data.endDate : new Date(data.endDate);
  return start < end;
};

export const dateRangeError = {
  message: "La date de début doit être antérieure à la date de fin",
  path: ["endDate"],
};

export const teamSizePredicate = (data: {
  minTeamSize?: number;
  maxTeamSize?: number;
}): boolean => {
  if (!data.minTeamSize || !data.maxTeamSize) return true;
  return data.maxTeamSize >= data.minTeamSize;
};

export const teamSizeError = {
  message:
    "La taille maximale doit être supérieure ou égale à la taille minimale",
  path: ["maxTeamSize"],
};

export const scoreRangePredicate = (data: {
  scoreEnabled?: boolean;
  minScore?: number | null;
  maxScore?: number | null;
}): boolean => {
  if (data.scoreEnabled === false) return true;
  if (data.minScore != null && data.maxScore != null)
    return data.minScore <= data.maxScore;
  return true;
};

export const scoreRangeError = {
  message: "Le score minimum doit être inférieur ou égal au score maximum",
  path: ["maxScore"],
};
