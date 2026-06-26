// Re-export des types depuis le package partagé
export {
  type TournamentParticipant,
  type TournamentAdmin,
  type TournamentAdminRole,
} from '@skol-arena/shared'

// Types spécifiques au frontend pour compatibilité
import type { User } from './user'
import type { TournamentParticipant } from '@skol-arena/shared'

export interface TournamentParticipantExpanded extends TournamentParticipant {
  expand?: {
    user?: User
  }
}

export type TournamentParticipantCreate = Omit<TournamentParticipant, 'id' | 'joinedAt'>
