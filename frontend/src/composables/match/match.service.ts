import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { matchApi } from './match.api'
import { useParticipantService } from '../participant.service'
import type {
  ClientMatchModel,
  ClientCreateMatchRequest,
  ClientUpdateMatchRequest,
  ReportMatchResultRequestData,
  ConfirmMatchRequestData,
  ContestMatchRequestData,
  FinalizeMatchRequestData,
  ListMatchesQuery,
  ClientValidateMatchRequest,
  MatchStatus,
  ParticipantListItem,
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

  /**
   * Validate match for a specific step
   */
  async function validateMatchForStep(
    tournamentId: string,
    step: string,
    playerIdsA?: string[],
    playerIdsB?: string[],
    matchId?: string,
  ): Promise<ValidationResult> {
    try {
      const dataToValidate: ClientValidateMatchRequest = {
        tournamentId,
        playerIdsA,
        playerIdsB,
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
   * Check if can proceed to next step
   */
  function canProceedToNextStep(step: string, playerIdsA: string[], playerIdsB: string[]): boolean {
    const result = validationResult.value
    if (!result) return false

    switch (step) {
      case '1':
        return result.valid && playerIdsA.length > 0 && playerIdsB.length > 0
      case '2':
        return result.valid
      default:
        return false
    }
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

      router.push(`/tournaments/${tournamentId}?tab=1`)
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

      router.push(`/tournaments/${tournamentId}?tab=1`)
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

  const getMatch = async (id: string): Promise<ClientMatchModel> => {
    return await matchApi.getById(id)
  }

  const listMatches = async (filters?: ListMatchesQuery): Promise<ClientMatchModel[]> => {
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
      toast.add({
        severity: 'warn',
        summary: 'Contestation enregistrée',
        detail: 'Votre contestation a été enregistrée. Un administrateur examinera le cas.',
        life: 5000,
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
    validateMatchForStep,
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
    finalizeMatch,
    validateMatch,
  }
}
