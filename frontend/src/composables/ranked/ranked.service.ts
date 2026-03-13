import { ref } from 'vue'
import { rankedApi } from './ranked.api'
import type { RankedSeason } from './ranked.api'
import type {
  CreateRankedSeasonInput,
  UpdateRankedSeasonInput,
  ClientPlayerMmr,
  ClientMmrHistoryEntry,
  RankBoundaries,
  RankTier,
} from '@skill-arena/shared/types/index'

export function useRankedService() {
  const seasons = ref<RankedSeason[]>([])
  const currentSeason = ref<RankedSeason | null>(null)
  const leaderboard = ref<ClientPlayerMmr[]>([])
  const boundaries = ref<RankBoundaries | null>(null)
  const playerMmr = ref<ClientPlayerMmr | null>(null)
  const playerHistory = ref<ClientMmrHistoryEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadSeasons(filters?: { disciplineId?: string; status?: string }) {
    loading.value = true
    error.value = null
    try {
      seasons.value = await rankedApi.listSeasons(filters)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des saisons'
    } finally {
      loading.value = false
    }
  }

  async function loadSeasonById(id: string) {
    loading.value = true
    error.value = null
    try {
      currentSeason.value = await rankedApi.getSeasonById(id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement de la saison'
    } finally {
      loading.value = false
    }
  }

  async function createSeason(data: CreateRankedSeasonInput): Promise<RankedSeason | null> {
    loading.value = true
    error.value = null
    try {
      const season = await rankedApi.createSeason(data)
      seasons.value.unshift(season as RankedSeason)
      return season as RankedSeason
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la création de la saison'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateSeason(id: string, data: UpdateRankedSeasonInput): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const updated = await rankedApi.updateSeason(id, data)
      currentSeason.value = updated as RankedSeason
      return true
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Erreur lors de la mise à jour de la saison'
      return false
    } finally {
      loading.value = false
    }
  }

  async function startSeason(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const updated = await rankedApi.startSeason(id)
      currentSeason.value = updated as RankedSeason
      return true
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Erreur lors du démarrage de la saison'
      return false
    } finally {
      loading.value = false
    }
  }

  async function endSeason(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const updated = await rankedApi.endSeason(id)
      currentSeason.value = updated as RankedSeason
      return true
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Erreur lors de la clôture de la saison"
      return false
    } finally {
      loading.value = false
    }
  }

  async function loadLeaderboard(seasonId: string) {
    loading.value = true
    error.value = null
    try {
      const data = await rankedApi.getLeaderboard(seasonId)
      leaderboard.value = data.players
      boundaries.value = data.boundaries ?? null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du classement'
    } finally {
      loading.value = false
    }
  }

  async function loadPlayerMmr(seasonId: string, playerId: string) {
    loading.value = true
    error.value = null
    try {
      const data = await rankedApi.getPlayerMmr(seasonId, playerId)
      playerMmr.value = data.mmr
      boundaries.value = data.boundaries ?? null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du MMR'
    } finally {
      loading.value = false
    }
  }

  async function loadPlayerHistory(seasonId: string, playerId: string) {
    loading.value = true
    error.value = null
    try {
      playerHistory.value = await rankedApi.getPlayerHistory(seasonId, playerId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Erreur lors du chargement de l'historique"
    } finally {
      loading.value = false
    }
  }

  function getRank(mmr: number, bounds: RankBoundaries | null): RankTier {
    if (!bounds) return 'legend'
    if (mmr > bounds.challengerMax) return 'challenger'
    if (mmr > bounds.masterMax) return 'master'
    if (mmr > bounds.strategistMax) return 'strategist'
    return 'legend'
  }

  return {
    seasons,
    currentSeason,
    leaderboard,
    boundaries,
    playerMmr,
    playerHistory,
    loading,
    error,
    loadSeasons,
    loadSeasonById,
    createSeason,
    updateSeason,
    startSeason,
    endSeason,
    loadLeaderboard,
    loadPlayerMmr,
    loadPlayerHistory,
    getRank,
  }
}
