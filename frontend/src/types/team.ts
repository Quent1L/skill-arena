/**
 * Types pour la gestion des équipes
 * Basés sur le schéma PocketBase
 */

import type { User } from './user'

export interface Team {
  id: string
  name?: string // Optionnel : seulement pour les équipes multi-joueurs
  tournament: string // ID du tournoi
  players: string[] // IDs des joueurs
  created: string
  updated: string
}

export interface TeamExpanded extends Team {
  expand?: {
    players?: User[]
  }
}

export type TeamCreate = Omit<Team, 'id' | 'created' | 'updated'>
export type TeamUpdate = Partial<Omit<Team, 'id' | 'created' | 'updated' | 'tournament'>>

export interface TeamStats {
  team: TeamExpanded
  matches_played: number
  wins: number
  draws: number
  losses: number
  points: number
  score_for: number
  score_against: number
  score_difference: number
  rank: number
}
