import { z } from "zod";
import { tournamentModeSchema, teamModeSchema, tournamentStatusSchema, } from "./enums";
// ============================================
// Schémas Zod pour la validation
// ============================================
// Schéma de base sans validations cross-field pour les formulaires
export const baseTournamentFormSchema = z.object({
    name: z
        .string({ required_error: "Le nom est requis" })
        .min(3, "Le nom doit contenir au moins 3 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères"),
    description: z
        .string()
        .max(500, "La description ne peut pas dépasser 500 caractères")
        .optional(),
    mode: tournamentModeSchema,
    teamMode: teamModeSchema,
    minTeamSize: z
        .number({ required_error: "La taille minimale de l'équipe est requise" })
        .int()
        .min(1, "La taille minimale est 1"),
    maxTeamSize: z
        .number({ required_error: "La taille maximale de l'équipe est requise" })
        .int()
        .min(1, "La taille minimale est 1"),
    maxMatchesPerPlayer: z.number().int().min(1).max(100).default(10).optional(),
    maxTimesWithSamePartner: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(2)
        .optional(),
    maxTimesWithSameOpponent: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(2)
        .optional(),
    pointPerVictory: z.number().int().min(0).default(3).optional(),
    pointPerDraw: z.number().int().min(0).default(1).optional(),
    pointPerLoss: z.number().int().min(0).default(0).optional(),
    allowDraw: z.boolean().default(true).optional(),
    startDate: z.date({ required_error: "La date de début est requise" }),
    endDate: z.date({ required_error: "La date de fin est requise" }),
});
// Schéma pour la mise à jour sans validations cross-field
export const baseTournamentUpdateFormSchema = z.object({
    name: z
        .string()
        .min(3, "Le nom doit contenir au moins 3 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères")
        .optional(),
    description: z
        .string()
        .max(500, "La description ne peut pas dépasser 500 caractères")
        .optional(),
    mode: tournamentModeSchema.optional(),
    teamMode: teamModeSchema.optional(),
    minTeamSize: z.number().int().min(1, "La taille minimale est 1").optional(),
    maxTeamSize: z.number().int().min(1, "La taille minimale est 1").optional(),
    maxMatchesPerPlayer: z.number().int().min(1).max(100).optional(),
    maxTimesWithSamePartner: z.number().int().min(1).max(10).optional(),
    maxTimesWithSameOpponent: z.number().int().min(1).max(10).optional(),
    pointPerVictory: z.number().int().min(0).optional(),
    pointPerDraw: z.number().int().min(0).optional(),
    pointPerLoss: z.number().int().min(0).optional(),
    allowDraw: z.boolean().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    status: tournamentStatusSchema.optional(),
});
// Schéma pour la création de tournoi (utilisé par le frontend avec Date objects)
export const createTournamentFormSchema = baseTournamentFormSchema
    .refine((data) => data.startDate < data.endDate, {
    message: "La date de début doit être antérieure à la date de fin",
    path: ["endDate"],
})
    .refine((data) => data.maxTeamSize >= data.minTeamSize, {
    message: "La taille maximale doit être supérieure ou égale à la taille minimale",
    path: ["maxTeamSize"],
});
// Schéma de base pour les données de tournoi
const baseTournamentDataSchema = z.object({
    name: z
        .string({ required_error: "Le nom est requis" })
        .min(3, "Le nom doit contenir au moins 3 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères"),
    description: z
        .string()
        .max(500, "La description ne peut pas dépasser 500 caractères")
        .optional(),
    mode: tournamentModeSchema,
    teamMode: teamModeSchema,
    minTeamSize: z
        .number({ required_error: "La taille minimale de l'équipe est requise" })
        .int()
        .min(1, "La taille minimale est 1"),
    maxTeamSize: z
        .number({ required_error: "La taille maximale de l'équipe est requise" })
        .int()
        .min(1, "La taille minimale est 1"),
    maxMatchesPerPlayer: z.number().int().min(1).max(100).default(10).optional(),
    maxTimesWithSamePartner: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(2)
        .optional(),
    maxTimesWithSameOpponent: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(2)
        .optional(),
    pointPerVictory: z.number().int().min(0).default(3).optional(),
    pointPerDraw: z.number().int().min(0).default(1).optional(),
    pointPerLoss: z.number().int().min(0).default(0).optional(),
    allowDraw: z.boolean().default(true).optional(),
    startDate: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    endDate: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});
// Schéma pour l'API (validation des données d'entrée - SANS createdBy)
export const createTournamentRequestSchema = baseTournamentDataSchema
    .refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start < end;
}, {
    message: "La date de début doit être antérieure à la date de fin",
    path: ["endDate"],
})
    .refine((data) => data.maxTeamSize >= data.minTeamSize, {
    message: "La taille maximale doit être supérieure ou égale à la taille minimale",
    path: ["maxTeamSize"],
});
// Schéma pour l'API complet (AVEC createdBy - pour les types uniquement)
export const createTournamentSchema = baseTournamentDataSchema
    .extend({
    createdBy: z.string().uuid(),
})
    .refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start < end;
}, {
    message: "La date de début doit être antérieure à la date de fin",
    path: ["endDate"],
})
    .refine((data) => data.maxTeamSize >= data.minTeamSize, {
    message: "La taille maximale doit être supérieure ou égale à la taille minimale",
    path: ["maxTeamSize"],
});
// Schéma pour la mise à jour (frontend avec Date objects)
export const updateTournamentFormSchema = baseTournamentUpdateFormSchema
    .refine((data) => {
    if (data.startDate && data.endDate) {
        return data.startDate < data.endDate;
    }
    return true;
}, {
    message: "La date de début doit être antérieure à la date de fin",
    path: ["endDate"],
})
    .refine((data) => {
    if (data.minTeamSize && data.maxTeamSize) {
        return data.maxTeamSize >= data.minTeamSize;
    }
    return true;
}, {
    message: "La taille maximale doit être supérieure ou égale à la taille minimale",
    path: ["maxTeamSize"],
});
// Schéma pour la mise à jour (API avec strings ISO)
export const updateTournamentSchema = z
    .object({
    name: z
        .string()
        .min(3, "Le nom doit contenir au moins 3 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères")
        .optional(),
    description: z
        .string()
        .max(500, "La description ne peut pas dépasser 500 caractères")
        .optional(),
    mode: tournamentModeSchema.optional(),
    teamMode: teamModeSchema.optional(),
    minTeamSize: z.number().int().min(1, "La taille minimale est 1").optional(),
    maxTeamSize: z.number().int().min(1, "La taille minimale est 1").optional(),
    maxMatchesPerPlayer: z.number().int().min(1).max(100).optional(),
    maxTimesWithSamePartner: z.number().int().min(1).max(10).optional(),
    maxTimesWithSameOpponent: z.number().int().min(1).max(10).optional(),
    pointPerVictory: z.number().int().min(0).optional(),
    pointPerDraw: z.number().int().min(0).optional(),
    pointPerLoss: z.number().int().min(0).optional(),
    allowDraw: z.boolean().optional(),
    startDate: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
        .optional(),
    endDate: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
        .optional(),
    status: tournamentStatusSchema.optional(),
})
    .refine((data) => {
    if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start < end;
    }
    return true;
}, {
    message: "La date de début doit être antérieure à la date de fin",
    path: ["endDate"],
})
    .refine((data) => {
    if (data.minTeamSize && data.maxTeamSize) {
        return data.maxTeamSize >= data.minTeamSize;
    }
    return true;
}, {
    message: "La taille maximale doit être supérieure ou égale à la taille minimale",
    path: ["maxTeamSize"],
});
export const changeTournamentStatusSchema = z.object({
    status: tournamentStatusSchema,
});
export const listTournamentsQuerySchema = z.object({
    status: tournamentStatusSchema.optional(),
    mode: tournamentModeSchema.optional(),
    createdBy: z.string().uuid().optional(),
});
// ============================================
// Utilitaires de conversion
// ============================================
/**
 * Convertit des données de formulaire (avec Date objects) en payload API (avec ISO strings)
 */
export function formDataToApiPayload(formData) {
    const { startDate, endDate, ...rest } = formData;
    return {
        ...rest,
        ...(startDate && { startDate: startDate.toISOString().split("T")[0] }),
        ...(endDate && { endDate: endDate.toISOString().split("T")[0] }),
    };
}
/**
 * Convertit des données API (avec ISO strings) en données de formulaire (avec Date objects)
 */
export function apiDataToFormData(apiData) {
    const { startDate, endDate, ...rest } = apiData;
    return {
        ...rest,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
    };
}
