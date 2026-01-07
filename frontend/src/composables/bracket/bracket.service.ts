import { ref, computed } from 'vue'
import { bracketApi, type BracketType, type BracketResponse } from './bracket.api'

export function useBracketService() {
  const bracketData = ref<BracketResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const generating = ref(false)

  const hasMatches = computed(() => {
    return bracketData.value !== null && 
           bracketData.value.match && 
           bracketData.value.match.length > 0
  })

  async function loadBracket(tournamentId: string) {
    loading.value = true
    error.value = null
    try {
      const response = await bracketApi.getBracket(tournamentId)
      bracketData.value = response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du bracket'
      bracketData.value = null
    } finally {
      loading.value = false
    }
  }

  async function generateBracket(tournamentId: string, bracketType: BracketType) {
    generating.value = true
    error.value = null
    try {
      const response = await bracketApi.generateBracket(tournamentId, bracketType)
      // Reload bracket after generation
      await loadBracket(tournamentId)
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la génération du bracket'
      throw err
    } finally {
      generating.value = false
    }
  }

  return {
    bracketData,
    loading,
    error,
    generating,
    hasMatches,
    loadBracket,
    generateBracket,
  }
}
