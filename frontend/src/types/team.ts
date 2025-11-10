// Re-export des types depuis le package partagé
export { type Team, type TeamMember, type TeamStats } from '@skill-arena/shared'

// Types spécifiques au frontend pour compatibilité
import type { User } from './user'
import type { Team } from '@skill-arena/shared'

export interface TeamExpanded extends Team {
  expand?: {
    players?: User[]
  }
}

export type TeamCreate = Omit<Team, 'id' | 'createdAt' | 'updatedAt'>
export type TeamUpdate = Partial<Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'tournamentId'>>

export interface TeamStatsExpanded {
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
