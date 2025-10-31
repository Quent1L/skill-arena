/**
 * Types pour la gestion des participants aux tournois
 */

import type { User } from './user'

export interface TournamentParticipant {
  id: string
  tournament: string // ID du tournoi
  user: string // ID de l'utilisateur
  created: string
  updated: string
}

export interface TournamentParticipantExpanded extends TournamentParticipant {
  expand?: {
    user?: User
  }
}

export type TournamentParticipantCreate = Omit<TournamentParticipant, 'id' | 'created' | 'updated'>
