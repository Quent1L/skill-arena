import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { matchApi } from './match.api'
import { useParticipantService } from './participant.service'
import type {
  MatchModel,
  CreateMatchRequestData,
  UpdateMatchRequestData,
  ReportMatchResultRequestData,
  ConfirmMatchResultRequestData,
  ListMatchesQuery,
  ValidateMatchRequestData,
  MatchStatus,
  ParticipantListItem,
} from '@skill-arena/shared'

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
      const participants = (await getTournamentParticipants(
        tournamentId,
      )) as ParticipantListItem[]
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
  ): Promise<ValidationResult> {
    try {
      const dataToValidate: ValidateMatchRequestData = {
        tournamentId,
        playerIdsA,
        playerIdsB,
      }

      const result = await matchApi.validate(dataToValidate)
      validationResult.value = result
      return result
    } catch (err) {
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
  function canProceedToNextStep(
    step: string,
    playerIdsA: string[],
    playerIdsB: string[],
  ): boolean {
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
    data: CreateMatchRequestData,
    scheduledDate: Date | null,
    tournamentId: string,
  ): Promise<MatchModel | null> {
    loading.value = true
    error.value = null

    try {
      const matchPayload: CreateMatchRequestData = {
        ...data,
        ...(data.status === 'scheduled' &&
          scheduledDate && {
            scheduledAt: scheduledDate.toISOString(),
          }),
      }

      const match = await matchApi.create(matchPayload)

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
   * Get team players names from IDs
   */
  function getTeamPlayersNames(playerIds: string[]): string[] {
    return playerIds.map((id) => playersMap.value[id] ?? `Joueur ${id}`)
  }

  // Basic API methods
  const createMatch = async (data: CreateMatchRequestData): Promise<MatchModel> => {
    return await matchApi.create(data)
  }

  const getMatch = async (id: string): Promise<MatchModel> => {
    return await matchApi.getById(id)
  }

  const listMatches = async (filters?: ListMatchesQuery): Promise<MatchModel[]> => {
    return await matchApi.list(filters)
  }

  const updateMatch = async (id: string, data: UpdateMatchRequestData): Promise<MatchModel> => {
    return await matchApi.update(id, data)
  }

  const deleteMatch = async (id: string): Promise<void> => {
    await matchApi.delete(id)
  }

  const reportMatchResult = async (
    id: string,
    data: ReportMatchResultRequestData,
  ): Promise<MatchModel> => {
    return await matchApi.reportResult(id, data)
  }

  const confirmMatchResult = async (
    id: string,
    data: ConfirmMatchResultRequestData,
  ): Promise<MatchModel> => {
    return await matchApi.confirmResult(id, data)
  }

  const validateMatch = async (data: ValidateMatchRequestData) => {
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
    getTeamPlayersNames,

    // Basic API methods
    createMatch,
    getMatch,
    listMatches,
    updateMatch,
    deleteMatch,
    reportMatchResult,
    confirmMatchResult,
    validateMatch,
  }
}
