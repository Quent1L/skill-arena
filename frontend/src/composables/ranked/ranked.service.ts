import { ref } from 'vue'
import { rankedApi } from './ranked.api'
import type { RankedSeason, FinishedSeasonSummary } from './ranked.api'
import type {
  CreateRankedSeasonInput,
  UpdateRankedSeasonInput,
  CreateRankTierInput,
  UpdateRankTierInput,
  ClientPlayerMmr,
  ClientMmrHistoryEntry,
  ClientRankTier,
  ClientTournamentSummary,
} from '@skill-arena/shared/types/index'

export function getSubRank(mmr: number, tier: ClientRankTier, allTiers: ClientRankTier[]): number | null {
  if (tier.subRanks <= 1) return null
  const sorted = [...allTiers].sort((a, b) => a.level - b.level)
  const nextTier = sorted.find((t) => t.level > tier.level)
  const prevTier = [...sorted].reverse().find((t) => t.level < tier.level)
  const rangeTop = nextTier?.minMmr ?? (tier.minMmr + (prevTier ? tier.minMmr - prevTier.minMmr : 1000))
  const range = rangeTop - tier.minMmr
  if (range <= 0) return 1
  const subRankRange = range / tier.subRanks
  const position = mmr - tier.minMmr
  const raw = tier.subRanks - Math.floor(position / subRankRange)
  return Math.max(1, Math.min(tier.subRanks, raw))
}

export function getTierLabel(tier: ClientRankTier | null, subRank: number | null): string {
  if (!tier) return '—'
  if (subRank !== null) return `${tier.name} ${subRank}`
  return tier.name
}

export function useRankedService() {
  const seasons = ref<ClientTournamentSummary[]>([])
  const currentSeason = ref<RankedSeason | null>(null)
  const leaderboard = ref<ClientPlayerMmr[]>([])
  const tiers = ref<ClientRankTier[]>([])
  const playerMmr = ref<ClientPlayerMmr | null>(null)
  const playerHistory = ref<ClientMmrHistoryEntry[]>([])
  const finishedSeasons = ref<FinishedSeasonSummary[]>([])
  const playerHistoryHasMore = ref(false)
  const playerHistoryOffset = ref(0)
  const playerHistorySeasonId = ref('')
  const playerHistoryPlayerId = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const HISTORY_PAGE_SIZE = 10

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
      tiers.value = data.tiers ?? []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du classement'
    } finally {
      loading.value = false
    }
  }

  async function loadPlayerMmr(seasonId: string, playerId: string) {
      const data = await rankedApi.getPlayerMmr(seasonId, playerId)
      playerMmr.value = data.mmr
      tiers.value = data.tiers ?? []
  }

  async function loadPlayerHistory(seasonId: string, playerId: string, append = false) {
    if (!append) {
      playerHistory.value = []
      playerHistoryOffset.value = 0
      playerHistoryHasMore.value = false
      playerHistorySeasonId.value = seasonId
      playerHistoryPlayerId.value = playerId
    }
    loading.value = true
    error.value = null
    try {
      const results = await rankedApi.getPlayerHistory(seasonId, playerId, {
        limit: HISTORY_PAGE_SIZE,
        offset: playerHistoryOffset.value,
      })
      if (append) {
        playerHistory.value = [...playerHistory.value, ...results]
      } else {
        playerHistory.value = results
      }
      playerHistoryOffset.value += results.length
      playerHistoryHasMore.value = results.length === HISTORY_PAGE_SIZE
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Erreur lors du chargement de l'historique"
    } finally {
      loading.value = false
    }
  }

  async function loadMoreHistory() {
    if (!playerHistoryHasMore.value || loading.value) return
    await loadPlayerHistory(playerHistorySeasonId.value, playerHistoryPlayerId.value, true)
  }

  async function loadTiers(seasonId: string) {
    loading.value = true
    error.value = null
    try {
      tiers.value = await rankedApi.getTiers(seasonId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des rangs'
    } finally {
      loading.value = false
    }
  }

  async function createTier(seasonId: string, data: CreateRankTierInput): Promise<ClientRankTier | null> {
    loading.value = true
    error.value = null
    try {
      const tier = await rankedApi.createTier(seasonId, data)
      tiers.value = [...tiers.value, tier].sort((a, b) => a.level - b.level)
      return tier
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la création du rang'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateTier(seasonId: string, level: number, data: UpdateRankTierInput): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const updated = await rankedApi.updateTier(seasonId, level, data)
      tiers.value = tiers.value.map((t) => (t.level === level ? updated : t))
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du rang'
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteTier(seasonId: string, level: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await rankedApi.deleteTier(seasonId, level)
      tiers.value = tiers.value.filter((t) => t.level !== level)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la suppression du rang'
      return false
    } finally {
      loading.value = false
    }
  }

  async function recalculateTiers(seasonId: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      tiers.value = await rankedApi.recalculateTiers(seasonId)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du recalcul des seuils'
      return false
    } finally {
      loading.value = false
    }
  }

  function getRank(mmr: number, tierList: ClientRankTier[]): ClientRankTier | null {
    if (!tierList.length) return null
    return [...tierList].sort((a, b) => b.level - a.level).find((t) => mmr >= t.minMmr) ?? tierList[0]
  }

  async function loadFinishedSeasons() {
    loading.value = true
    error.value = null
    try {
      finishedSeasons.value = await rankedApi.getFinishedSeasons()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des saisons terminées'
    } finally {
      loading.value = false
    }
  }

  return {
    seasons,
    currentSeason,
    leaderboard,
    tiers,
    playerMmr,
    playerHistory,
    finishedSeasons,
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
    loadMoreHistory,
    playerHistoryHasMore,
    getRank,
    loadFinishedSeasons,
    loadTiers,
    createTier,
    updateTier,
    deleteTier,
    recalculateTiers,
  }
}
