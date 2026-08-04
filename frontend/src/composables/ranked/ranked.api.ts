import http from '@/config/ApiConfig'
import type {
  CreateRankedSeasonInput,
  UpdateRankedSeasonInput,
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

const BASE_URL = '/api/ranked'

export type FinishedSeasonSummary = {
  id: string
  name: string
  startDate: string
  endDate: string
  discipline?: { id: string; name: string } | null
}

export type RankedSeason = {
  id: string
  name: string
  description?: string | null
  disciplineId: string
  status: string
  startDate: string
  endDate: string
  minTeamSize: number
  maxTeamSize: number
  allowDraw?: boolean
  scoreEnabled?: boolean
  minScore?: number | null
  maxScore?: number | null
  rulesId?: string | null
  validationMode?: string | null
  validationTimerHours?: number | null
  rankedConfig?: {
    baseMmr: number
    kFactor: number
    placementMatches: number
    usePreviousMmr: boolean
    allowAsymmetricMatches: boolean
    sourceTierSeasonId?: string | null
  } | null
  rankTiers?: ClientRankTier[]
  discipline?: { id: string; name: string } | null
  rules?: { id: string; title: string } | null
}

export type LeaderboardResponse = {
  players: ClientPlayerMmr[]
}

export type SeasonMmrLeaderboardResponse = {
  players: ClientSeasonMmrPlayer[]
}

export type PlayerMmrResponse = {
  mmr: ClientPlayerMmr
  tiers: ClientRankTier[]
  opponentQuality?: OpponentQualityStats
  chartHistory: MmrChartPoint[]
}

/**
 * Raw API calls to backend - no business logic here
 */
export const rankedApi = {
  async createSeason(data: CreateRankedSeasonInput): Promise<RankedSeason> {
    const response = await http.post<RankedSeason>(`${BASE_URL}/seasons`, data)
    return response.data
  },

  async listSeasons(filters?: { disciplineId?: string; status?: string }): Promise<ClientTournamentSummary[]> {
    const params = new URLSearchParams()
    if (filters?.disciplineId) params.set('disciplineId', filters.disciplineId)
    if (filters?.status) params.set('status', filters.status)
    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await http.get<ClientTournamentSummary[]>(`${BASE_URL}/seasons${query}`)
    return response.data
  },

  async getSeasonById(id: string): Promise<RankedSeason> {
    const response = await http.get<RankedSeason>(`${BASE_URL}/seasons/${id}`)
    return response.data
  },

  async updateSeason(id: string, data: UpdateRankedSeasonInput): Promise<RankedSeason> {
    const response = await http.patch<RankedSeason>(`${BASE_URL}/seasons/${id}`, data)
    return response.data
  },

  async startSeason(id: string): Promise<RankedSeason> {
    const response = await http.post<RankedSeason>(`${BASE_URL}/seasons/${id}/start`)
    return response.data
  },

  async endSeason(id: string): Promise<RankedSeason> {
    const response = await http.post<RankedSeason>(`${BASE_URL}/seasons/${id}/end`)
    return response.data
  },

  async getLeaderboard(id: string): Promise<LeaderboardResponse> {
    const response = await http.get<LeaderboardResponse>(`${BASE_URL}/seasons/${id}/leaderboard`)
    return response.data
  },

  async getProvisionalLeaderboard(id: string): Promise<LeaderboardResponse> {
    const response = await http.get<LeaderboardResponse>(`${BASE_URL}/seasons/${id}/leaderboard/provisional`)
    return response.data
  },

  async getSeasonMmrLeaderboard(id: string): Promise<SeasonMmrLeaderboardResponse> {
    const response = await http.get<SeasonMmrLeaderboardResponse>(`${BASE_URL}/seasons/${id}/leaderboard/season-stats`)
    return response.data
  },

  async getPlayerMmr(seasonId: string, playerId: string): Promise<PlayerMmrResponse> {
    const response = await http.get<PlayerMmrResponse>(
      `${BASE_URL}/seasons/${seasonId}/players/${playerId}`,
    )
    return response.data
  },

  async getWeeklyMmrLeaders(seasonId: string, from: string): Promise<WeeklyMmrLeaders> {
    const response = await http.get<WeeklyMmrLeaders>(
      `${BASE_URL}/seasons/${seasonId}/weekly-mmr?from=${encodeURIComponent(from)}`,
    )
    return response.data
  },

  async getTiers(seasonId: string): Promise<ClientRankTier[]> {
    const response = await http.get<ClientRankTier[]>(`${BASE_URL}/seasons/${seasonId}/tiers`)
    return response.data
  },

  async createTier(seasonId: string, data: CreateRankTierInput): Promise<ClientRankTier[]> {
    const response = await http.post<ClientRankTier[]>(`${BASE_URL}/seasons/${seasonId}/tiers`, data)
    return response.data
  },

  async updateTier(seasonId: string, level: number, data: UpdateRankTierInput): Promise<ClientRankTier> {
    const response = await http.patch<ClientRankTier>(`${BASE_URL}/seasons/${seasonId}/tiers/${level}`, data)
    return response.data
  },

  async deleteTier(seasonId: string, level: number): Promise<ClientRankTier[]> {
    const response = await http.delete<ClientRankTier[]>(`${BASE_URL}/seasons/${seasonId}/tiers/${level}`)
    return response.data
  },

  async recalculateTiers(seasonId: string): Promise<ClientRankTier[]> {
    const response = await http.post<ClientRankTier[]>(`${BASE_URL}/seasons/${seasonId}/tiers/recalculate`)
    return response.data
  },

  async getFinishedSeasons(): Promise<FinishedSeasonSummary[]> {
    const response = await http.get<FinishedSeasonSummary[]>(`${BASE_URL}/seasons/finished`)
    return response.data
  },

  async getPlayerHistory(
    seasonId: string,
    playerId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<ClientMmrHistoryEntry[]> {
    const query = new URLSearchParams()
    if (params?.limit !== undefined) query.set('limit', String(params.limit))
    if (params?.offset !== undefined) query.set('offset', String(params.offset))
    const qs = query.toString() ? `?${query.toString()}` : ''
    const response = await http.get<ClientMmrHistoryEntry[]>(
      `${BASE_URL}/seasons/${seasonId}/players/${playerId}/history${qs}`,
    )
    return response.data
  },
}
