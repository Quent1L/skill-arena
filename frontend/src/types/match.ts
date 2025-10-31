/**
 * Types pour la gestion des matchs
 * Basés sur le schéma PocketBase
 */

import type { Team } from './team'
import type { User } from './user'

export type MatchStatus = 'pending' | 'pending_confirmation' | 'played'

export interface Match {
  id: string
  tournament: string // ID du tournoi
  teamA: string // ID de l'équipe A
  teamB: string // ID de l'équipe B
  scoreA?: number
  scoreB?: number
  winner?: string // ID de l'équipe gagnante
  played_at: string
  validated_by?: string // ID de l'utilisateur qui a validé
  notes?: string
  created: string
  updated: string
}

export interface MatchExpanded extends Match {
  expand?: {
    teamA?: Team
    teamB?: Team
    winner?: Team
    validated_by?: User
  }
}

export interface MatchWithStatus extends MatchExpanded {
  status: MatchStatus
  canEdit: boolean
  canValidate: boolean
}

export type MatchCreate = Omit<Match, 'id' | 'created' | 'updated'>
export type MatchUpdate = Partial<Omit<Match, 'id' | 'created' | 'updated' | 'tournament'>>

export interface ScoreSubmission {
  matchId: string
  scoreA: number
  scoreB: number
  notes?: string
}
