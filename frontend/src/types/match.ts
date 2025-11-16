// Re-export des types depuis le package partagé
// Note: On utilise les types Client car le frontend reçoit les dates en tant qu'objets Date
export {
  type ClientMatchModel as Match,
  type ClientMatchModel as MatchModel,
  type MatchParticipation as MatchParticipant,
  type MatchStatus,
} from '@skill-arena/shared/types/index'

// Types spécifiques au frontend pour compatibilité
import type { Team } from './team'
import type { User } from './user'
import type { ClientMatchModel } from '@skill-arena/shared/types/index'

export interface MatchExpanded extends ClientMatchModel {
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

export type MatchCreate = Omit<ClientMatchModel, 'id' | 'createdAt' | 'updatedAt'>
export type MatchUpdate = Partial<
  Omit<ClientMatchModel, 'id' | 'createdAt' | 'updatedAt' | 'tournamentId'>
>

export interface ScoreSubmission {
  matchId: string
  scoreA: number
  scoreB: number
  notes?: string
}
