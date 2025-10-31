/**
 * Configuration et helpers PocketBase
 */

import PocketBase from 'pocketbase'
import type { Tournament } from '@/types/tournament'
import type { Match } from '@/types/match'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'
import type { TournamentParticipant } from '@/types/participant'

// URL de l'API PocketBase
export const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'

// Instance PocketBase globale
export const pb = new PocketBase(POCKETBASE_URL)

// Collections typées
export const collections = {
  tournaments: pb.collection<Tournament>('tournaments'),
  matches: pb.collection<Match>('matches'),
  teams: pb.collection<Team>('teams'),
  users: pb.collection<User>('users'),
  tournament_participants: pb.collection<TournamentParticipant>('tournament_participants'),
} as const

/**
 * Formate une date pour l'affichage
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/**
 * Formate une date avec l'heure
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Détermine le statut d'un tournoi
 */
export function getTournamentStatus(tournament: Tournament): 'upcoming' | 'active' | 'finished' {
  const now = new Date()
  const start = new Date(tournament.start_date)
  const end = new Date(tournament.end_date)

  if (now < start) return 'upcoming'
  if (now > end) return 'finished'
  return 'active'
}

/**
 * Retourne le label du statut du tournoi
 */
export function getTournamentStatusLabel(status: 'upcoming' | 'active' | 'finished'): string {
  const labels = {
    upcoming: 'À venir',
    active: 'En cours',
    finished: 'Terminé',
  }
  return labels[status]
}

/**
 * Retourne la couleur badge pour le statut
 */
export function getTournamentStatusColor(status: 'upcoming' | 'active' | 'finished'): string {
  const colors = {
    upcoming: 'blue',
    active: 'green',
    finished: 'gray',
  }
  return colors[status]
}
