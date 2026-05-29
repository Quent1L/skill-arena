import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { matchApi } from './match.api'
import { useParticipantService } from '../participant.service'
import type {
  ClientMatchModel,
  ClientMatchDetail,
  ClientCreateMatchRequest,
  ClientUpdateMatchRequest,
  ReportMatchResultRequestData,
  ConfirmMatchRequestData,
  ContestMatchRequestData,
  RespondToMatchRequestData,
  FinalizeMatchRequestData,
  ListMatchCardsQuery,
  PaginatedMatchCards,
  ClientValidateMatchRequest,
  MatchStatus,
  ParticipantListItem,
  MatchSideInput,
} from '@skill-arena/shared/types/index'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function useMatchService() {
  const router = useRouter()
  const toast = useToast()
  const { getTournamentParticipants } = useParticipantService()

  const validationResult = ref<ValidationResult | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const playersMap = ref<Record<string, string>>({})

  /**
   * Create players map from participants
   */
  async function loadPlayersMap(tournamentId: string): Promise<Record<string, string>> {
    try {
      const participants = (await getTournamentParticipants(tournamentId)) as ParticipantListItem[]
      const map: Record<string, string> = {}
      for (const p of participants) {
        map[p.userId] = p.user.displayName
      }
      playersMap.value = map
      return map
    } catch (err) {
      console.error('Erreur loading participants map:', err)
      return {}
    }
  }

  async function validateParticipants(
    tournamentId: string,
    allPlayerIds: string[],
    playedAt?: Date,
    matchId?: string,
  ): Promise<ValidationResult> {
    try {
      const dataToValidate: ClientValidateMatchRequest = {
        tournamentId,
        allPlayerIds,
        playedAt,
        ...(matchId && { matchId }),
      }
      const result = await matchApi.validate(dataToValidate)
      validationResult.value = result
      return result
    } catch {
      const errorResult: ValidationResult = {
        valid: false,
        errors: ['Erreur lors de la validation'],
        warnings: [],
      }
      validationResult.value = errorResult
      return errorResult
    }
  }

  /**
   * Validate match with full sides composition
   */
  async function validateMatchSides(
    tournamentId: string,
    sides: MatchSideInput[],
    playedAt?: Date,
    matchId?: string,
  ): Promise<ValidationResult> {
    try {
      const dataToValidate: ClientValidateMatchRequest = {
        tournamentId,
        sides,
        playedAt,
        ...(matchId && { matchId }),
      }
      const result = await matchApi.validate(dataToValidate)
      validationResult.value = result
      return result
    } catch {
      const errorResult: ValidationResult = {
        valid: false,
        errors: ['Erreur lors de la validation'],
        warnings: [],
      }
      validationResult.value = errorResult
      return errorResult
    }
  }

  function canProceedToNextStep(
    _step: string,
    playerIdsA: string[],
    playerIdsB: string[],
    teamAId?: string,
    teamBId?: string,
  ): boolean {
    const result = validationResult.value
    if (!result) return false
    if (teamAId && teamBId) return result.valid
    return result.valid && playerIdsA.length > 0 && playerIdsB.length > 0
  }

  /**
   * Check if can create match
   */
  function canCreateMatch(
    status: MatchStatus,
    scheduledDate: Date | null,
    scoreA: number,
    scoreB: number,
  ): boolean {
    const result = validationResult.value
    if (!result?.valid) return false
    if (!status) return false

    if (status === 'scheduled' && !scheduledDate) return false
    if (status === 'reported' && (scoreA < 0 || scoreB < 0)) return false

    return true
  }

  /**
   * Create match with error handling and navigation
   */
  async function createMatchWithNavigation(
    data: ClientCreateMatchRequest,
    tournamentId: string,
  ): Promise<ClientMatchModel | null> {
    loading.value = true
    error.value = null

    try {
      const match = await matchApi.create(data)

      toast.add({
        severity: 'success',
        summary: 'Succès',
        detail: 'Match créé avec succès',
        life: 3000,
      })

      await router.replace({ name: 'tournament-tab', params: { id: tournamentId, tab: 'matches' } })
      return match
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du match'
      error.value = message

      toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail: message,
        life: 5000,
      })

      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Update match with error handling and navigation
   */
  async function updateMatchWithNavigation(
    matchId: string,
    data: ClientUpdateMatchRequest,
    tournamentId: string,
  ): Promise<ClientMatchModel | null> {
    loading.value = true
    error.value = null

    try {
      const match = await matchApi.update(matchId, data)

      toast.add({
        severity: 'success',
        summary: 'Succès',
        detail: 'Match mis à jour avec succès',
        life: 3000,
      })

      await router.replace({ name: 'tournament-tab', params: { id: tournamentId, tab: 'matches' } })
      return match
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du match'
      error.value = message

      toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail: message,
        life: 5000,
      })

      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Get team players names from IDs
   */
  function getTeamPlayersNames(playerIds: string[]): string[] {
    return playerIds.map((id) => playersMap.value[id] ?? `Joueur ${id}`)
  }

  // Basic API methods
  const createMatch = async (data: ClientCreateMatchRequest): Promise<ClientMatchModel> => {
    return await matchApi.create(data)
  }

  const getMatch = async (id: string): Promise<ClientMatchDetail> => {
    return await matchApi.getById(id)
  }

  const listMatches = async (filters?: Omit<Partial<ListMatchCardsQuery>, 'bracketMode'> & { bracketMode?: 'true' | 'false' }): Promise<PaginatedMatchCards> => {
    return await matchApi.list(filters)
  }

  const updateMatch = async (
    id: string,
    data: ClientUpdateMatchRequest,
  ): Promise<ClientMatchModel> => {
    return await matchApi.update(id, data)
  }

  const deleteMatch = async (id: string): Promise<void> => {
    await matchApi.delete(id)
  }

  const reportMatchResult = async (
    id: string,
    data: ReportMatchResultRequestData,
  ): Promise<ClientMatchModel> => {
    return await matchApi.reportResult(id, data)
  }

  const confirmMatchResult = async (
    id: string,
    data: ConfirmMatchRequestData = {},
  ): Promise<ClientMatchModel> => {
    try {
      const match = await matchApi.confirmResult(id, data)
      toast.add({
        severity: 'success',
        summary: 'Confirmation enregistrée',
        detail: 'Votre confirmation a été enregistrée avec succès',
        life: 3000,
      })
      return match
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la confirmation'
      toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail: errorMessage,
        life: 5000,
      })
      throw err
    }
  }

  const contestMatchResult = async (
    id: string,
    data: ContestMatchRequestData,
  ): Promise<ClientMatchModel> => {
    try {
      const match = await matchApi.contestResult(id, data)
      const hasProposal = data.proposedScoreA !== undefined && data.proposedScoreB !== undefined
      toast.add({
        severity: 'warn',
        summary: hasProposal ? 'Score proposé' : 'Contestation enregistrée',
        detail: hasProposal
          ? `Vous avez proposé le score ${data.proposedScoreA} - ${data.proposedScoreB}. Les autres joueurs doivent reconfirmer.`
          : 'Votre contestation a été enregistrée. Un administrateur examinera le cas.',
        life: 6000,
      })
      return match
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la contestation'
      toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail: errorMessage,
        life: 5000,
      })
      throw err
    }
  }

  const respondToMatch = async (
    id: string,
    data: RespondToMatchRequestData,
  ): Promise<ClientMatchDetail> => {
    try {
      const match = await matchApi.respondToMatch(id, data)
      if (data.type === 'agree') {
        toast.add({
          severity: 'success',
          summary: 'Acceptation enregistrée',
          detail: 'Votre acceptation a été enregistrée avec succès',
          life: 3000,
        })
      } else {
        const hasProposal = data.proposedScoreA !== undefined && data.proposedScoreB !== undefined
        toast.add({
          severity: 'warn',
          summary: hasProposal ? 'Score proposé' : 'Contestation enregistrée',
          detail: hasProposal
            ? `Vous avez proposé le score ${data.proposedScoreA} - ${data.proposedScoreB}. Les autres joueurs doivent reconfirmer.`
            : 'Votre contestation a été enregistrée.',
          life: 6000,
        })
      }
      return match
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la réponse'
      toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail: errorMessage,
        life: 5000,
      })
      throw err
    }
  }

  const cancelMatch = async (id: string): Promise<ClientMatchModel> => {
    try {
      const match = await matchApi.cancel(id)
      toast.add({
        severity: 'info',
        summary: 'Match annulé',
        detail: 'Le match a été annulé avec succès',
        life: 3000,
      })
      return match
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'annulation"
      toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail: errorMessage,
        life: 5000,
      })
      throw err
    }
  }

  const finalizeMatch = async (
    id: string,
    data: FinalizeMatchRequestData,
  ): Promise<ClientMatchModel> => {
    try {
      const match = await matchApi.finalize(id, data)
      toast.add({
        severity: 'success',
        summary: 'Match finalisé',
        detail: 'Le match a été finalisé avec succès',
        life: 3000,
      })
      return match
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la finalisation'
      toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail: errorMessage,
        life: 5000,
      })
      throw err
    }
  }

  const validateMatch = async (data: ClientValidateMatchRequest) => {
    return await matchApi.validate(data)
  }

  return {
    // State
    validationResult,
    loading,
    error,
    playersMap,

    // Business logic methods
    loadPlayersMap,
    validateParticipants,
    validateMatchSides,
    canProceedToNextStep,
    canCreateMatch,
    createMatchWithNavigation,
    updateMatchWithNavigation,
    getTeamPlayersNames,

    // Basic API methods
    createMatch,
    getMatch,
    listMatches,
    updateMatch,
    deleteMatch,
    reportMatchResult,
    confirmMatchResult,
    contestMatchResult,
    respondToMatch,
    cancelMatch,
    finalizeMatch,
    validateMatch,
  }
}
