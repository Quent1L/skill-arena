import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { bracketApi } from './bracket.api'
import type { ClientBracketData, GenerateBracketInput } from '@skill-arena/shared/types/index'

/**
 * Bracket service - Business logic and state management
 */
export function useBracketService() {
  const toast = useToast()

  const bracketData = ref<ClientBracketData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const canGenerate = ref(false)
  const canGenerateReason = ref<string | null>(null)
  const currentParticipants = ref<number>(0)

  // Computed properties
  const hasBracket = computed(() => bracketData.value !== null)

  /**
   * Load bracket data for a tournament
   */
  async function loadBracket(tournamentId: string) {
    loading.value = true
    error.value = null

    try {
      const data = await bracketApi.getBracket(tournamentId)
      bracketData.value = data
      return data
    } catch (err: unknown) {
      // Handle 404 gracefully - bracket not yet initialized
      if (err instanceof Error && err.message?.includes('404')) {
        bracketData.value = null
        error.value = null
        return null
      }

      error.value = err instanceof Error ? err.message : 'Error loading bracket'
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.value,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Check if bracket can be generated
   */
  async function checkCanGenerate(tournamentId: string) {
    try {
      const result = await bracketApi.canGenerate(tournamentId)
      canGenerate.value = result.canGenerate
      canGenerateReason.value = result.reason || null
      currentParticipants.value = result.currentParticipants ?? 0
      return result
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error checking bracket eligibility'
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: errorMsg,
        life: 5000,
      })
      throw err
    }
  }

  /**
   * Generate bracket for a tournament
   */
  async function generateBracket(tournamentId: string, input: GenerateBracketInput) {
    loading.value = true
    error.value = null

    try {
      const data = await bracketApi.generate(tournamentId, input)
      bracketData.value = data

      toast.add({
        severity: 'success',
        summary: 'Bracket Generated',
        detail: 'The tournament bracket has been successfully generated',
        life: 5000,
      })

      return data
    } catch (err: unknown) {
      let detail = err instanceof Error ? err.message : 'Error generating bracket'
      if (err instanceof Error && (err as Error & { cause?: unknown }).cause === 'CHAMPIONSHIP_PARTICIPANTS_WITHOUT_MATCHES') {
        const participants = ((err as Error & { details?: { participants?: Array<{ name: string }> } }).details?.participants) ?? []
        const names = participants.map((p) => p.name).join(', ')
        detail = names.length
          ? `Ces participants n'ont joué aucun match dans le championnat : ${names}`
          : "Certains participants n'ont joué aucun match dans le championnat sélectionné"
      }
      error.value = detail
      toast.add({
        severity: 'error',
        summary: 'Génération impossible',
        detail,
        life: 8000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Regenerate bracket (delete and generate new)
   */
  async function regenerateBracket(tournamentId: string, input: GenerateBracketInput) {
    loading.value = true
    error.value = null

    try {
      // Delete existing bracket first
      await bracketApi.deleteBracket(tournamentId)

      // Generate new bracket
      const data = await bracketApi.generate(tournamentId, input)
      bracketData.value = data

      toast.add({
        severity: 'success',
        summary: 'Bracket regénéré',
        detail: 'Le tournoi a été regénéré avec succès',
        life: 5000,
      })

      return data
    } catch (err: unknown) {
      let detail = err instanceof Error ? err.message : 'Error regenerating bracket'
      if (err instanceof Error && (err as Error & { cause?: unknown }).cause === 'CHAMPIONSHIP_PARTICIPANTS_WITHOUT_MATCHES') {
        const participants = ((err as Error & { details?: { participants?: Array<{ name: string }> } }).details?.participants) ?? []
        const names = participants.map((p) => p.name).join(', ')
        detail = names.length
          ? `Ces participants n'ont joué aucun match dans le championnat : ${names}`
          : "Certains participants n'ont joué aucun match dans le championnat sélectionné"
      }
      error.value = detail
      toast.add({
        severity: 'error',
        summary: 'Génération impossible',
        detail,
        life: 8000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete bracket
   */
  async function deleteBracket(tournamentId: string) {
    loading.value = true
    error.value = null

    try {
      await bracketApi.deleteBracket(tournamentId)
      bracketData.value = null

      toast.add({
        severity: 'success',
        summary: 'Bracket Deleted',
        detail: 'The tournament bracket has been successfully deleted',
        life: 5000,
      })
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error deleting bracket'
      toast.add({
        severity: 'error',
        summary: 'Deletion Failed',
        detail: error.value,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear bracket data
   */
  function clearBracket() {
    bracketData.value = null
    error.value = null
  }

  return {
    // State
    bracketData,
    loading,
    error,
    canGenerate,
    canGenerateReason,
    currentParticipants,

    // Computed
    hasBracket,

    // Methods
    loadBracket,
    checkCanGenerate,
    generateBracket,
    regenerateBracket,
    deleteBracket,
    clearBracket,
  }
}
