import { ref } from 'vue'
import { matchHistoryApi } from './match-history.api'
import type { ClientMatchCard } from '@skill-arena/shared/types/index'

const PAGE_SIZE = 10

export function useMatchHistoryService() {
  const history = ref<ClientMatchCard[]>([])
  const loading = ref(false)
  const hasMore = ref(false)
  const error = ref<string | null>(null)

  let currentPlayerId = ''
  let currentTournamentId: string | undefined
  let offset = 0

  async function loadHistory(
    playerId: string,
    tournamentId?: string,
    append = false,
  ) {
    if (!append) {
      history.value = []
      hasMore.value = false
      offset = 0
      currentPlayerId = playerId
      currentTournamentId = tournamentId
    }

    loading.value = true
    error.value = null
    try {
      const result = await matchHistoryApi.getPlayerHistory(playerId, {
        limit: PAGE_SIZE,
        offset,
        tournamentId,
      })
      if (append) {
        history.value = [...history.value, ...result.data]
      } else {
        history.value = result.data
      }
      offset += result.data.length
      hasMore.value = result.hasMore
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Erreur lors du chargement de l'historique"
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || loading.value) return
    await loadHistory(currentPlayerId, currentTournamentId, true)
  }

  return { history, loading, hasMore, error, loadHistory, loadMore }
}
