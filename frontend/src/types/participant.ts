// Re-export types from the shared package
export {
  type TournamentParticipant,
  type TournamentAdmin,
  type TournamentAdminRole,
} from '@skol-arena/shared'

// Frontend-specific types for compatibility
import type { User } from './user'
import type { TournamentParticipant } from '@skol-arena/shared'

export interface TournamentParticipantExpanded extends TournamentParticipant {
  expand?: {
    user?: User
  }
}

export type TournamentParticipantCreate = Omit<TournamentParticipant, 'id' | 'joinedAt'>
