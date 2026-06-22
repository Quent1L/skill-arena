import { ref } from 'vue'
import { rankedApi } from './ranked.api'
import type { RankedSeason, FinishedSeasonSummary } from './ranked.api'
import type {
  CreateRankedSeasonInput,
  UpdateRankedSeasonInput,
  CreateRankedSeasonFormData,
  UpdateRankedSeasonFormData,
  CreateRankTierInput,
  UpdateRankTierInput,
  ClientPlayerMmr,
  ClientMmrHistoryEntry,
  ClientRankTier,
  ClientTournamentSummary,
  OpponentQualityStats,
} from '@skill-arena/shared/types/index'
import { formDataToApiPayload } from '@skill-arena/shared/types/index'

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

export const TIER_SIZE = 200
export const MMR_FLOOR = 700

export function getLp(mmr: number, tier: ClientRankTier): number {
  if (mmr < MMR_FLOOR) return 0
  return Math.max(0, mmr - tier.minMmr)
}

export function isTopTier(tier: ClientRankTier, allTiers: ClientRankTier[]): boolean {
  return !allTiers.some((t) => t.level > tier.level)
}

export function getMatchLabel(
  mmrBefore: number,
  opponentAvgMmr: number,
  mmrDelta: number,
): string | null {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentAvgMmr - mmrBefore) / 400))
  if (mmrBefore < 900 && opponentAvgMmr > mmrBefore + 100) return 'Protection Rookie 🛡️'
  if (expectedScore < 0.35 && mmrDelta > 0) return 'Exploit 🚀'
  if (expectedScore > 0.65) return 'Statut Favori ⚖️'
  return null
}

export function useRankedService() {
  const seasons = ref<ClientTournamentSummary[]>([])
  const currentSeason = ref<RankedSeason | null>(null)
  const leaderboard = ref<ClientPlayerMmr[]>([])
  const provisionalLeaderboard = ref<ClientPlayerMmr[]>([])
  const tiers = ref<ClientRankTier[]>([])
  const playerMmr = ref<ClientPlayerMmr | null>(null)
  const playerOpponentQuality = ref<OpponentQualityStats | undefined>(undefined)
  const playerHistory = ref<ClientMmrHistoryEntry[]>([])
  const finishedSeasons = ref<FinishedSeasonSummary[]>([])
  const playerHistoryHasMore = ref(false)
  const playerHistoryOffset = ref(0)
  const playerHistorySeasonId = ref('')
  const playerHistoryPlayerId = ref('')
  const loading = ref(false)
  const provisionalLoading = ref(false)
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

  async function createSeason(
    data: CreateRankedSeasonFormData,
  ): Promise<RankedSeason | null> {
    loading.value = true
    error.value = null
    try {
      const payload = formDataToApiPayload(data) as unknown as CreateRankedSeasonInput
      const season = await rankedApi.createSeason(payload)
      seasons.value.unshift(season as RankedSeason)
      return season as RankedSeason
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la création de la saison'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateSeason(
    id: string,
    data: UpdateRankedSeasonFormData,
  ): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const payload = formDataToApiPayload(data) as unknown as UpdateRankedSeasonInput
      const updated = await rankedApi.updateSeason(id, payload)
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
      const [data, tiersData] = await Promise.all([
        rankedApi.getLeaderboard(seasonId),
        rankedApi.getTiers(seasonId),
      ])
      leaderboard.value = data.players
      tiers.value = tiersData
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du classement'
    } finally {
      loading.value = false
    }
  }

  async function loadProvisionalLeaderboard(seasonId: string) {
    provisionalLoading.value = true
    error.value = null
    try {
      const data = await rankedApi.getProvisionalLeaderboard(seasonId)
      provisionalLeaderboard.value = data.players
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du classement provisoire'
    } finally {
      provisionalLoading.value = false
    }
  }

  async function loadPlayerMmr(seasonId: string, playerId: string) {
    loading.value = true
    try {
      const data = await rankedApi.getPlayerMmr(seasonId, playerId)
      playerMmr.value = data.mmr
      tiers.value = data.tiers ?? []
      playerOpponentQuality.value = data.opponentQuality
      return data.chartHistory
    } catch {
      playerMmr.value = null
      playerOpponentQuality.value = undefined
      return []
    } finally {
      loading.value = false
    }
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
    provisionalLeaderboard,
    tiers,
    playerMmr,
    playerOpponentQuality,
    playerHistory,
    finishedSeasons,
    loading,
    provisionalLoading,
    error,
    loadSeasons,
    loadSeasonById,
    createSeason,
    updateSeason,
    startSeason,
    endSeason,
    loadLeaderboard,
    loadProvisionalLeaderboard,
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
