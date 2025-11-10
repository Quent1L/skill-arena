// Re-export des types depuis le package partagé
export {
  type TournamentMode,
  type TournamentStatus,
  type TeamMode,
  type BaseTournament as Tournament,
  type CreateTournamentInput as TournamentCreate,
  type UpdateTournamentInput as TournamentUpdate,
  type TournamentWithStats,
  // Schemas pour la validation
  tournamentModeSchema,
  tournamentStatusSchema,
  teamModeSchema,
  createTournamentSchema,
  updateTournamentSchema,
} from '@skill-arena/shared'

// Types spécifiques au frontend (si nécessaire)
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
