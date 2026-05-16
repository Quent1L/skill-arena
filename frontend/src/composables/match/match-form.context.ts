import type { InjectionKey, Ref } from 'vue'
import type {
  ClientBaseTournament,
  ClientTeam,
  MatchSideInput,
  OutcomeType,
  OutcomeReason,
} from '@skill-arena/shared/types/index'

export interface MatchFormState {
  playedAt: Date | null
  sides: MatchSideInput[]
  allPlayerIds: string[]
  winnerPosition: number | null
  scorePerSide: Record<number, number>
  outcomeTypeId: string | null
  outcomeReasonId: string | null
}

export interface TournamentPlayer {
  id: string
  displayName: string
}

export interface MatchFormContext {
  formState: Ref<MatchFormState>
  activeStep: Ref<string>
  tournament: Ref<ClientBaseTournament | null>
  playersMap: Ref<Record<string, string>>
  teams: Ref<ClientTeam[]>
  participants: Ref<TournamentPlayer[]>
  outcomeTypes: Ref<OutcomeType[]>
  outcomeReasons: Ref<OutcomeReason[]>
  scoreInstructions: Ref<string | null>
  isLoading: Ref<boolean>
}

export const MATCH_FORM_KEY: InjectionKey<MatchFormContext> = Symbol('matchForm')
