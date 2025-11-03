import { z } from "zod";

export const tournamentModeSchema = z.enum(["championship", "bracket"]);
export const teamModeSchema = z.enum(["static", "flex"]);
export const tournamentStatusSchema = z.enum([
  "draft",
  "open",
  "ongoing",
  "finished",
]);

export const createTournamentSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().max(500).optional(),
  mode: tournamentModeSchema,
  teamMode: teamModeSchema,
  teamSize: z.number().int().min(1).max(2),
  maxMatchesPerPlayer: z.number().int().min(1).max(100).default(10),
  maxTimesWithSamePartner: z.number().int().min(1).max(10).default(2),
  maxTimesWithSameOpponent: z.number().int().min(1).max(10).default(2),
  pointPerVictory: z.number().int().min(0).default(3),
  pointPerDraw: z.number().int().min(0).default(1),
  pointPerLoss: z.number().int().min(0).default(0),
  allowDraw: z.boolean().default(true),
  startDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const updateTournamentSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  mode: tournamentModeSchema.optional(),
  teamMode: teamModeSchema.optional(),
  teamSize: z.number().int().min(1).max(2).optional(),
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
});

export const changeTournamentStatusSchema = z.object({
  status: tournamentStatusSchema,
});

export const listTournamentsQuerySchema = z.object({
  status: tournamentStatusSchema.optional(),
  mode: tournamentModeSchema.optional(),
  createdBy: z.string().uuid().optional(),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type ChangeTournamentStatusInput = z.infer<
  typeof changeTournamentStatusSchema
>;
export type ListTournamentsQuery = z.infer<typeof listTournamentsQuerySchema>;
