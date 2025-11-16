import { ref } from 'vue'
import { standingsApi } from './standings.api'
import type { StandingsResult, StandingsEntry } from '@skill-arena/shared/types/index'

/**
 * Standings service - Business logic and state management
 */
export function useStandingsService() {
  const standings = ref<StandingsEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Load official standings
   */
  async function loadOfficialStandings(tournamentId: string) {
    loading.value = true
    error.value = null

    // Garder les anciennes données pendant le chargement pour éviter le layout shift
    const previousStandings = [...standings.value]

    try {
      const result = await standingsApi.getOfficial(tournamentId)
      standings.value = result.standings
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du classement'
      // En cas d'erreur, garder les anciennes données si disponibles
      if (previousStandings.length === 0) {
        standings.value = []
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Load provisional standings
   */
  async function loadProvisionalStandings(tournamentId: string) {
    loading.value = true
    error.value = null

    // Garder les anciennes données pendant le chargement pour éviter le layout shift
    const previousStandings = [...standings.value]

    try {
      const result = await standingsApi.getProvisional(tournamentId)
      standings.value = result.standings
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du classement'
      // En cas d'erreur, garder les anciennes données si disponibles
      if (previousStandings.length === 0) {
        standings.value = []
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    standings,
    loading,
    error,
    loadOfficialStandings,
    loadProvisionalStandings,
  }
}

