import { z } from "zod";
import {
  type TournamentMode,
  type TeamMode,
  type TournamentStatus,
  type ValidationMode,
  tournamentModeSchema,
  teamModeSchema,
  tournamentStatusSchema,
  validationModeSchema,
} from "./enums";
import {
  baseSeasonFormSchema,
  baseSeasonUpdateFormSchema,
  dateRangePredicate,
  dateRangeError,
  teamSizePredicate,
  teamSizeError,
  scoreRangePredicate,
  scoreRangeError,
} from "./season-form";

// ============================================
// Types and interfaces for tournaments
// ============================================

export interface BaseTournament {
  id: string;
  name: string;
  description?: string;
  mode: TournamentMode;
  teamMode: TeamMode;
  minTeamSize: number;
  maxTeamSize: number;
  maxMatchesPerPlayer: number;
  maxTimesWithSamePartner: number;
  maxTimesWithSameOpponent: number;
  pointPerVictory: number;
  pointPerDraw: number;
  pointPerLoss: number;
  allowDraw: boolean;
  scoreEnabled: boolean;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  status: TournamentStatus;
  disciplineId?: string;
  discipline?: {
    id: string;
    name: string;
  };
  rulesId?: string | null;
  rules?: {
    id: string;
    title: string;
  } | null;
  minScore?: number | null;
  maxScore?: number | null;
  validationMode: ValidationMode;
  validationTimerHours?: number | null;
  organizationId?: string | null;
  createdBy: string; // uuid
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface CreateTournamentInput {
  name: string;
  description?: string;
  mode: TournamentMode;
  teamMode: TeamMode;
  minTeamSize: number;
  maxTeamSize: number;
  maxMatchesPerPlayer?: number;
  maxTimesWithSamePartner?: number;
  maxTimesWithSameOpponent?: number;
  pointPerVictory?: number;
  pointPerDraw?: number;
  pointPerLoss?: number;
  allowDraw?: boolean;
  scoreEnabled?: boolean;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  disciplineId?: string;
  minScore?: number | null;
  maxScore?: number | null;
  validationMode?: ValidationMode;
  validationTimerHours?: number | null;
  createdBy: string; // uuid
}

export interface UpdateTournamentInput {
  name?: string;
  description?: string;
  mode?: TournamentMode;
  teamMode?: TeamMode;
  minTeamSize?: number;
  maxTeamSize?: number;
  maxMatchesPerPlayer?: number;
  maxTimesWithSamePartner?: number;
  maxTimesWithSameOpponent?: number;
  pointPerVictory?: number;
  pointPerDraw?: number;
  pointPerLoss?: number;
  allowDraw?: boolean;
  scoreEnabled?: boolean;
  startDate?: string;
  endDate?: string;
  status?: TournamentStatus;
  disciplineId?: string;
  rulesId?: string | null;
  minScore?: number | null;
  maxScore?: number | null;
  validationMode?: ValidationMode;
  validationTimerHours?: number | null;
}

export interface ChangeTournamentStatusInput {
  status: TournamentStatus;
}

export interface ListTournamentsQuery {
  status?: TournamentStatus;
  mode?: TournamentMode;
  createdBy?: string;
}

export interface TournamentWithStats extends BaseTournament {
  participants_count: number;
  matches_played: number;
  matches_total: number;
}

// ============================================
// Zod schemas for validation
// ============================================

// Base schema without cross-field validations for forms
// Extends baseSeasonFormSchema (fields shared with ranked seasons) by adding
// fields specific to tournaments.
export const baseTournamentFormSchema = baseSeasonFormSchema.extend({
  mode: tournamentModeSchema,
  teamMode: teamModeSchema,
  maxMatchesPerPlayer: z.number().int().min(1).max(100).optional(),
  maxTimesWithSamePartner: z.number().int().min(1).max(10).optional(),
  maxTimesWithSameOpponent: z.number().int().min(1).max(10).optional(),
  pointPerVictory: z.number().int().min(0).optional(),
  pointPerDraw: z.number().int().min(0).optional(),
  pointPerLoss: z.number().int().min(0).optional(),
  validationMode: validationModeSchema.optional(),
  validationTimerHours: z.number().int().min(1).max(168).nullable().optional(),
});

// Schema for updates without cross-field validations
export const baseTournamentUpdateFormSchema = baseSeasonUpdateFormSchema.extend(
  {
    mode: tournamentModeSchema.optional(),
    teamMode: teamModeSchema.optional(),
    maxMatchesPerPlayer: z.number().int().min(1).max(100).optional(),
    maxTimesWithSamePartner: z.number().int().min(1).max(10).optional(),
    maxTimesWithSameOpponent: z.number().int().min(1).max(10).optional(),
    pointPerVictory: z.number().int().min(0).optional(),
    pointPerDraw: z.number().int().min(0).optional(),
    pointPerLoss: z.number().int().min(0).optional(),
    status: tournamentStatusSchema.optional(),
    validationMode: validationModeSchema.optional(),
    validationTimerHours: z.number().int().min(1).max(168).nullable().optional(),
  },
);

// Schema for tournament creation (used by the frontend with Date objects)
export const createTournamentFormSchema = baseTournamentFormSchema
  .refine(dateRangePredicate, dateRangeError)
  .refine(teamSizePredicate, teamSizeError)
  .refine(scoreRangePredicate, scoreRangeError);

// Base schema for tournament data
const baseTournamentDataSchema = z.object({
  name: z
    .string({ message: "Le nom est requis" })
    .min(3, "Le nom doit contenir au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  description: z.string().optional(),
  mode: tournamentModeSchema,
  teamMode: teamModeSchema,
  minTeamSize: z
    .number({ message: "La taille minimale de l'équipe est requise" })
    .int()
    .min(1, "La taille minimale est 1"),
  maxTeamSize: z
    .number({ message: "La taille maximale de l'équipe est requise" })
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
  scoreEnabled: z.boolean().default(true).optional(),
  startDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  disciplineId: z.string().uuid("ID de discipline invalide").optional(),
  minScore: z.number().int().min(0).nullable().optional(),
  maxScore: z.number().int().min(0).nullable().optional(),
  organizationId: z.string().uuid().optional().nullable(),
  validationMode: validationModeSchema.default("strict").optional(),
  validationTimerHours: z.number().int().min(1).max(168).nullable().optional(),
});

// Schema for the API (input data validation - WITHOUT createdBy)
export const createTournamentRequestSchema = baseTournamentDataSchema
  .refine(dateRangePredicate, dateRangeError)
  .refine(teamSizePredicate, teamSizeError);

// Schema for the full API (WITH createdBy - types only)
export const createTournamentSchema = baseTournamentDataSchema
  .extend({
    createdBy: z.string().uuid(),
  })
  .refine(dateRangePredicate, dateRangeError)
  .refine(teamSizePredicate, teamSizeError);

// Schema for updates (frontend with Date objects)
export const updateTournamentFormSchema = baseTournamentUpdateFormSchema
  .refine(dateRangePredicate, dateRangeError)
  .refine(teamSizePredicate, teamSizeError)
  .refine(scoreRangePredicate, scoreRangeError);

// Schema for updates (API with ISO strings)
export const updateTournamentSchema = z
  .object({
    name: z
      .string()
      .min(3, "Le nom doit contenir au moins 3 caractères")
      .max(100, "Le nom ne peut pas dépasser 100 caractères")
      .optional(),
    description: z.string().optional(),
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
    scoreEnabled: z.boolean().optional(),
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
    rulesId: z.string().uuid().nullable().optional(),
    minScore: z.number().int().min(0).nullable().optional(),
    maxScore: z.number().int().min(0).nullable().optional(),
    organizationId: z.string().uuid().optional().nullable(),
    validationMode: validationModeSchema.optional(),
    validationTimerHours: z.number().int().min(1).max(168).nullable().optional(),
  })
  .refine(dateRangePredicate, dateRangeError)
  .refine(teamSizePredicate, teamSizeError)
  .refine(scoreRangePredicate, scoreRangeError);

export const changeTournamentStatusSchema = z.object({
  status: tournamentStatusSchema,
});

export const listTournamentsQuerySchema = z.object({
  status: tournamentStatusSchema.optional(),
  mode: tournamentModeSchema.optional(),
  createdBy: z.string().uuid().optional(),
});

// ============================================
// Types inferred from schemas
// ============================================

// Types for forms (frontend)
export type BaseTournamentFormData = z.infer<typeof baseTournamentFormSchema>;
export type BaseTournamentUpdateFormData = z.infer<
  typeof baseTournamentUpdateFormSchema
>;
export type CreateTournamentFormData = z.infer<
  typeof createTournamentFormSchema
>;
export type UpdateTournamentFormData = z.infer<
  typeof updateTournamentFormSchema
>;

// Types for the API (backend)
export type CreateTournamentRequestData = z.infer<
  typeof createTournamentRequestSchema
>;
export type CreateTournamentApiData = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentApiData = z.infer<typeof updateTournamentSchema>;

// ============================================
// Conversion utilities
// ============================================

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Converts form data (with Date objects) into an API payload (with ISO strings)
 */
export function formDataToApiPayload<
  T extends { startDate?: Date; endDate?: Date },
>(
  formData: T,
): Omit<T, "startDate" | "endDate"> & {
  startDate?: string;
  endDate?: string;
} {
  const { startDate, endDate, ...rest } = formData;
  return {
    ...rest,
    ...(startDate && { startDate: toLocalDateStr(startDate) }),
    ...(endDate && { endDate: toLocalDateStr(endDate) }),
  };
}

/**
 * Converts API data (with ISO strings) into form data (with Date objects)
 */
export function apiDataToFormData<
  T extends { startDate?: string; endDate?: string },
>(
  apiData: T,
): Omit<T, "startDate" | "endDate"> & {
  startDate?: Date;
  endDate?: Date;
} {
  const { startDate, endDate, ...rest } = apiData;
  return {
    ...rest,
    ...(startDate && { startDate: new Date(startDate) }),
    ...(endDate && { endDate: new Date(endDate) }),
  };
}

// ============================================
// Types for the frontend (with Date dates instead of string)
// ============================================

/**
 * Type for BaseTournament on the frontend side - string dates are automatically
 * converted to Date objects by the xior interceptor
 */
export interface ClientBaseTournament extends Omit<
  BaseTournament,
  "startDate" | "endDate" | "createdAt" | "updatedAt"
> {
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lightweight type for tournament lists (listing API response)
 */
export interface TournamentSummary {
  id: string;
  name: string;
  mode: TournamentMode;
  teamMode: TeamMode;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  discipline?: { id: string; name: string; icon?: string | null } | null;
}

export interface ClientTournamentSummary extends Omit<
  TournamentSummary,
  "startDate" | "endDate"
> {
  startDate: Date;
  endDate: Date;
}

/**
 * Type for TournamentWithStats on the frontend side
 */
export interface ClientTournamentWithStats extends Omit<
  TournamentWithStats,
  "startDate" | "endDate" | "createdAt" | "updatedAt"
> {
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for CreateTournamentRequestData on the frontend side
 * Dates can be Date objects (will be serialized to strings by JSON.stringify)
 */
export interface ClientCreateTournamentRequest extends Omit<
  CreateTournamentRequestData,
  "startDate" | "endDate"
> {
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * Type for UpdateTournamentApiData on the frontend side
 * Dates can be Date objects (will be serialized to strings by JSON.stringify)
 */
export interface ClientUpdateTournamentRequest extends Omit<
  UpdateTournamentApiData,
  "startDate" | "endDate"
> {
  startDate?: Date | string;
  endDate?: Date | string;
}
