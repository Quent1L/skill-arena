import { ref } from 'vue'
import { playerApi } from './player.api'
import type {
  PlayerProfile,
  PlayerStatsResponse,
  PlayerStatsFilters,
  PlayerHeadToHeadRecord,
  PlayerTeamupRecord,
} from '@skill-arena/shared/types/index'

async function searchPlayers(query: string): Promise<PlayerProfile[]> {
  try {
    return await playerApi.search(query)
  } catch {
    return []
  }
}

export function usePlayerComparisonService() {
  const playerA = ref<PlayerStatsResponse | null>(null)
  const playerB = ref<PlayerStatsResponse | null>(null)
  const headToHead = ref<PlayerHeadToHeadRecord | null>(null)
  const together = ref<PlayerTeamupRecord | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadComparison(
    playerAId: string,
    playerBId: string,
    filters?: PlayerStatsFilters,
  ) {
    loading.value = true
    error.value = null
    try {
      const result = await playerApi.getComparison(playerAId, playerBId, filters)
      playerA.value = result.playerA
      playerB.value = result.playerB
      headToHead.value = result.headToHead
      together.value = result.together
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Erreur lors du chargement de la comparaison'
      playerA.value = null
      playerB.value = null
      headToHead.value = null
      together.value = null
    } finally {
      loading.value = false
    }
  }

  return {
    playerA,
    playerB,
    headToHead,
    together,
    loading,
    error,
    loadComparison,
    searchPlayers,
  }
}
