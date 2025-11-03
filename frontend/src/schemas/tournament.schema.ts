import { z } from 'zod'
import { format } from 'date-fns'

export const tournamentModeSchema = z.enum(['championship', 'bracket'])
export const teamModeSchema = z.enum(['static', 'flex'])
export const tournamentStatusSchema = z.enum(['draft', 'open', 'ongoing', 'finished'])

export const createTournamentSchema = z
  .object({
    name: z
      .string({ required_error: 'Le nom est requis' })
      .min(3, 'Le nom doit contenir au moins 3 caractères')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
    description: z
      .string()
      .max(500, 'La description ne peut pas dépasser 500 caractères')
      .optional(),
    mode: tournamentModeSchema,
    teamMode: teamModeSchema,
    teamSize: z
      .number({ required_error: "La taille de l'équipe est requise" })
      .int()
      .min(1, 'La taille minimale est 1')
      .max(2, 'La taille maximale est 2'),
    maxMatchesPerPlayer: z.number().int().min(1).max(100).default(10).optional(),
    maxTimesWithSamePartner: z.number().int().min(1).max(10).default(2).optional(),
    maxTimesWithSameOpponent: z.number().int().min(1).max(10).default(2).optional(),
    pointPerVictory: z.number().int().min(0).default(3).optional(),
    pointPerDraw: z.number().int().min(0).default(1).optional(),
    pointPerLoss: z.number().int().min(0).default(0).optional(),
    allowDraw: z.boolean().default(true).optional(),
    startDate: z.date({ required_error: 'La date de début est requise' }),
    endDate: z.date({ required_error: 'La date de fin est requise' }),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: 'La date de début doit être antérieure à la date de fin',
    path: ['endDate'],
  })

export const updateTournamentSchema = z
  .object({
    name: z.string().min(3, 'Le nom doit contenir au moins 3 caractères').max(100).optional(),
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
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    status: tournamentStatusSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate < data.endDate
      }
      return true
    },
    {
      message: 'La date de début doit être antérieure à la date de fin',
      path: ['endDate'],
    },
  )

export type CreateTournamentFormData = z.infer<typeof createTournamentSchema>
export type UpdateTournamentFormData = z.infer<typeof updateTournamentSchema>

/**
 * Helper to convert form data (with Date objects) to API payload (with ISO strings)
 */
export function toApiPayload<T extends { startDate?: Date; endDate?: Date }>(
  formData: T,
): Omit<T, 'startDate' | 'endDate'> & {
  startDate: string
  endDate: string
} {
  const { startDate, endDate, ...rest } = formData
  return {
    ...rest,
    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
  }
}
