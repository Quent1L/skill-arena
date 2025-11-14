// Re-export des types depuis le package partagé
export {
  type MatchModel as Match,
  type MatchResult,
  type MatchParticipant,
  type MatchStatus,
} from '@skill-arena/shared'

// Types spécifiques au frontend pour compatibilité
import type { Team } from './team'
import type { User } from './user'
import type { MatchModel } from '@skill-arena/shared'

export interface MatchExpanded extends MatchModel {
  expand?: {
    teamA?: Team
    teamB?: Team
    winner?: Team
    validated_by?: User
  }
}

export interface MatchWithStatus extends MatchExpanded {
  canEdit: boolean
  canValidate: boolean
}

export type MatchCreate = Omit<MatchModel, 'id' | 'createdAt' | 'updatedAt'>
export type MatchUpdate = Partial<
  Omit<MatchModel, 'id' | 'createdAt' | 'updatedAt' | 'tournamentId'>
>

export interface ScoreSubmission {
  matchId: string
  scoreA: number
  scoreB: number
  notes?: string
}
