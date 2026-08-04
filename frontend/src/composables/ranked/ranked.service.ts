import { ref } from 'vue'
import { startOfWeek } from 'date-fns'
import { i18n } from '@/i18n'
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
  ClientSeasonMmrPlayer,
  ClientMmrHistoryEntry,
  ClientRankTier,
  ClientTournamentSummary,
  OpponentQualityStats,
  MmrChartPoint,
  WeeklyMmrLeaders,
} from '@skol-arena/shared/types/index'
import { formDataToApiPayload } from '@skol-arena/shared/types/index'

export function getTierForMmr(mmr: number, allTiers: ClientRankTier[]): ClientRankTier | null {
  if (!allTiers.length) return null
  return (
    [...allTiers].sort((a, b) => b.level - a.level).find((tier) => mmr >= tier.minMmr) ?? allTiers[0]
  )
}

// Highest MMR reached over the season. Seeded with the starting MMR of the first
// match so a player who only ever lost still peaks at their entry level.
export function getPeakMmr(history: MmrChartPoint[]): number | null {
  if (!history.length) return null
  return history.reduce((peak, point) => Math.max(peak, point.mmrAfter), history[0].mmrBefore)
}

export type SeasonMmrMetric = 'peak' | 'average'

// Season leaderboards are served unsorted: the backend ships peak and average in one
// payload and the active view decides the ranking.
export function sortBySeasonMetric(
  players: ClientSeasonMmrPlayer[],
  metric: SeasonMmrMetric,
): ClientSeasonMmrPlayer[] {
  const value = (p: ClientSeasonMmrPlayer) => (metric === 'peak' ? p.peakMmr : p.avgMmr)
  return [...players].sort((a, b) => value(b) - value(a))
}

export function getWeeklyMmrGain(
  history: MmrChartPoint[],
  weekStart: Date,
): { mmrGained: number; matchesPlayed: number } {
  const from = weekStart.getTime()
  const played = history.filter((point) => new Date(point.playedAt).getTime() >= from)
  return {
    mmrGained: played.reduce((sum, point) => sum + point.mmrDelta, 0),
    matchesPlayed: played.length,
  }
}

// Monday 00:00, local time — the week the player actually lives in.
export function getCurrentWeekStart(now: Date = new Date()): Date {
  return startOfWeek(now, { weekStartsOn: 1 })
}

// Neighbours are resolved by order, never by `level ± 1`: levels are kept
// contiguous server-side, but a season edited before that guarantee existed can
// still have holes.
export function getNextTier(tier: ClientRankTier, allTiers: ClientRankTier[]): ClientRankTier | null {
  return (
    [...allTiers].sort((a, b) => a.level - b.level).find((t) => t.level > tier.level) ?? null
  )
}

export function getPrevTier(tier: ClientRankTier, allTiers: ClientRankTier[]): ClientRankTier | null {
  return (
    [...allTiers].sort((a, b) => b.level - a.level).find((t) => t.level < tier.level) ?? null
  )
}

export function getSubRank(mmr: number, tier: ClientRankTier, allTiers: ClientRankTier[]): number | null {
  if (tier.subRanks <= 1) return null
  const nextTier = getNextTier(tier, allTiers)
  const prevTier = getPrevTier(tier, allTiers)
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
  return getNextTier(tier, allTiers) === null
}

export function getMatchLabel(
  mmrBefore: number,
  opponentAvgMmr: number,
  mmrDelta: number,
): string | null {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentAvgMmr - mmrBefore) / 400))
  if (mmrBefore < 900 && opponentAvgMmr > mmrBefore + 100) return i18n.global.t('rankedService.matchLabel.rookieProtection')
  if (expectedScore < 0.35 && mmrDelta > 0) return i18n.global.t('rankedService.matchLabel.exploit')
  if (expectedScore > 0.65) return i18n.global.t('rankedService.matchLabel.favorite')
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
  const weeklyMmrLeaders = ref<WeeklyMmrLeaders | null>(null)
  const finishedSeasons = ref<FinishedSeasonSummary[]>([])
  const playerHistoryHasMore = ref(false)
  const playerHistoryOffset = ref(0)
  const playerHistorySeasonId = ref('')
  const playerHistoryPlayerId = ref('')
  const seasonMmrLeaderboard = ref<ClientSeasonMmrPlayer[]>([])
  const loading = ref(false)
  const provisionalLoading = ref(false)
  const seasonMmrLoading = ref(false)
  const error = ref<string | null>(null)

  const HISTORY_PAGE_SIZE = 10

  async function loadSeasons(filters?: { disciplineId?: string; status?: string }) {
    loading.value = true
    error.value = null
    try {
      seasons.value = await rankedApi.listSeasons(filters)
    } catch (err) {
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadSeasonsFailed')
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
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadSeasonFailed')
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
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.createSeasonFailed')
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
        err instanceof Error ? err.message : i18n.global.t('rankedService.errors.updateSeasonFailed')
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
        err instanceof Error ? err.message : i18n.global.t('rankedService.errors.startSeasonFailed')
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
        err instanceof Error ? err.message : i18n.global.t('rankedService.errors.endSeasonFailed')
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
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadLeaderboardFailed')
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
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadProvisionalLeaderboardFailed')
    } finally {
      provisionalLoading.value = false
    }
  }

  async function loadSeasonMmrLeaderboard(seasonId: string) {
    seasonMmrLoading.value = true
    error.value = null
    try {
      const data = await rankedApi.getSeasonMmrLeaderboard(seasonId)
      seasonMmrLeaderboard.value = data.players
    } catch (err) {
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadSeasonMmrLeaderboardFailed')
    } finally {
      seasonMmrLoading.value = false
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
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadHistoryFailed')
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
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadTiersFailed')
    } finally {
      loading.value = false
    }
  }

  // Create and delete return the whole ladder: the backend renumbers the levels
  // to keep them contiguous, so the local list has to be replaced, not patched.
  async function createTier(seasonId: string, data: CreateRankTierInput): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      tiers.value = await rankedApi.createTier(seasonId, data)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.createTierFailed')
      return false
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
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.updateTierFailed')
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteTier(seasonId: string, level: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      tiers.value = await rankedApi.deleteTier(seasonId, level)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.deleteTierFailed')
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
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.recalculateTiersFailed')
      return false
    } finally {
      loading.value = false
    }
  }

  function getRank(mmr: number, tierList: ClientRankTier[]): ClientRankTier | null {
    return getTierForMmr(mmr, tierList)
  }

  async function loadWeeklyMmrLeaders(seasonId: string) {
    loading.value = true
    error.value = null
    try {
      weeklyMmrLeaders.value = await rankedApi.getWeeklyMmrLeaders(
        seasonId,
        getCurrentWeekStart().toISOString(),
      )
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadWeeklyMmrFailed')
      weeklyMmrLeaders.value = null
    } finally {
      loading.value = false
    }
  }

  async function loadFinishedSeasons() {
    loading.value = true
    error.value = null
    try {
      finishedSeasons.value = await rankedApi.getFinishedSeasons()
    } catch (err) {
      error.value = err instanceof Error ? err.message : i18n.global.t('rankedService.errors.loadFinishedSeasonsFailed')
    } finally {
      loading.value = false
    }
  }

  return {
    seasons,
    currentSeason,
    leaderboard,
    provisionalLeaderboard,
    seasonMmrLeaderboard,
    tiers,
    playerMmr,
    playerOpponentQuality,
    playerHistory,
    weeklyMmrLeaders,
    finishedSeasons,
    loading,
    provisionalLoading,
    seasonMmrLoading,
    error,
    loadSeasons,
    loadSeasonById,
    createSeason,
    updateSeason,
    startSeason,
    endSeason,
    loadLeaderboard,
    loadProvisionalLeaderboard,
    loadSeasonMmrLeaderboard,
    loadPlayerMmr,
    loadPlayerHistory,
    loadMoreHistory,
    loadWeeklyMmrLeaders,
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
