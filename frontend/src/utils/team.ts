/**
 * Utilitaires pour la gestion des équipes
 */

import type { Team, TeamExpanded, User } from '@/types'

/**
 * Obtient le nom d'affichage d'une équipe
 * - Si l'équipe a un nom : retourne le nom
 * - Si l'équipe a 1 joueur : retourne le nom du joueur
 * - Sinon : retourne "Équipe sans nom"
 */
export function getTeamDisplayName(team: Team | TeamExpanded): string {
  // Si l'équipe a un nom, on l'utilise
  if (team.name) {
    return team.name
  }

  // Si c'est une TeamExpanded avec les joueurs chargés
  if ('expand' in team && team.expand?.players && Array.isArray(team.expand.players)) {
    const players = team.expand.players as User[]

    if (players.length === 1) {
      const player = players[0]
      if (player) {
        return player.name || player.username
      }
    }

    if (players.length > 1) {
      return `Équipe de ${players.length} joueurs`
    }
  }

  // Si on a juste les IDs des joueurs
  if (team.players.length === 1) {
    return 'Joueur solo'
  }

  return 'Équipe sans nom'
}

/**
 * Obtient une description courte de l'équipe
 */
export function getTeamDescription(team: TeamExpanded): string {
  if ('expand' in team && team.expand?.players && Array.isArray(team.expand.players)) {
    const players = team.expand.players as User[]
    const names = players.map((p) => p.name || p.username).join(', ')

    if (team.name) {
      return `${team.name} (${names})`
    }

    return names
  }

  return team.name || 'Équipe'
}

/**
 * Vérifie si une équipe a besoin d'un nom
 * (uniquement pour les équipes multi-joueurs)
 */
export function teamNeedsName(playerCount: number): boolean {
  return playerCount > 1
}
