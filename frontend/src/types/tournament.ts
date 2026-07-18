// Re-export types from the shared package
export {
  type TournamentMode,
  type TournamentStatus,
  type TeamMode,
  type BaseTournament as Tournament,
  type CreateTournamentInput as TournamentCreate,
  type UpdateTournamentInput as TournamentUpdate,
  type TournamentWithStats,
  // Schemas for validation
  tournamentModeSchema,
  tournamentStatusSchema,
  teamModeSchema,
  createTournamentSchema,
  updateTournamentSchema,
} from '@skol-arena/shared'

// Frontend-specific types (if needed)
export interface TournamentFormData {
  name: string
  description?: string
  mode: 'championship' | 'bracket'
  teamMode: 'static' | 'flex'
  minTeamSize: number
  maxTeamSize: number
  startDate: string
  endDate: string
}
