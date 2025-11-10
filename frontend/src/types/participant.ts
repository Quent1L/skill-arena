// Re-export des types depuis le package partagé
export {
  type TournamentParticipant,
  type TournamentAdmin,
  type TournamentAdminRole,
} from '@skill-arena/shared'

// Types spécifiques au frontend pour compatibilité
import type { User } from './user'
import type { TournamentParticipant } from '@skill-arena/shared'

export interface TournamentParticipantExpanded extends TournamentParticipant {
  expand?: {
    user?: User
  }
}

export type TournamentParticipantCreate = Omit<TournamentParticipant, 'id' | 'joinedAt'>
