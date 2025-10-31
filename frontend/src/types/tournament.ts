/**
 * Types pour la gestion des tournois
 * Basés sur le schéma PocketBase
 */

export type TournamentType = 'championship' | 'bracket'
export type TournamentStatus = 'upcoming' | 'active' | 'finished'
export type TeamFlexibility = 'fixed' | 'dynamic'

export interface Tournament {
  id: string
  name: string
  type: TournamentType
  description?: string
  min_team_size: number
  max_team_size: number
  allow_draws: boolean
  points_win?: number
  points_draw?: number
  points_loss?: number
  max_score?: number
  team_flexibility?: TeamFlexibility
  team_repeat_limit?: number
  start_date: string
  end_date: string
  created: string
  updated: string
}

export type TournamentCreate = Omit<Tournament, 'id' | 'created' | 'updated'>
export type TournamentUpdate = Partial<TournamentCreate>

export interface TournamentWithStats extends Tournament {
  status: TournamentStatus
  participants_count: number
  matches_played: number
  matches_total: number
}
