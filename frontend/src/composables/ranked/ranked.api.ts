import http from '@/config/ApiConfig'
import type {
  CreateRankedSeasonInput,
  UpdateRankedSeasonInput,
  ClientPlayerMmr,
  ClientMmrHistoryEntry,
  RankBoundaries,
} from '@skill-arena/shared/types/index'

const BASE_URL = '/api/ranked'

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
  rulesId?: string | null
  rankedConfig?: {
    baseMmr: number
    kFactor: number
    placementMatches: number
    usePreviousMmr: boolean
    allowAsymmetricMatches: boolean
  } | null
  rankBoundaries?: RankBoundaries | null
  discipline?: { id: string; name: string } | null
  rules?: { id: string; title: string } | null
}

export type LeaderboardResponse = {
  players: ClientPlayerMmr[]
  boundaries: RankBoundaries | null | undefined
}

export type PlayerMmrResponse = {
  mmr: ClientPlayerMmr
  boundaries: RankBoundaries | null | undefined
}

/**
 * Raw API calls to backend - no business logic here
 */
export const rankedApi = {
  async createSeason(data: CreateRankedSeasonInput): Promise<RankedSeason> {
    const response = await http.post<RankedSeason>(`${BASE_URL}/seasons`, data)
    return response.data
  },

  async listSeasons(filters?: { disciplineId?: string; status?: string }): Promise<RankedSeason[]> {
    const params = new URLSearchParams()
    if (filters?.disciplineId) params.set('disciplineId', filters.disciplineId)
    if (filters?.status) params.set('status', filters.status)
    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await http.get<RankedSeason[]>(`${BASE_URL}/seasons${query}`)
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

  async getPlayerMmr(seasonId: string, playerId: string): Promise<PlayerMmrResponse> {
    const response = await http.get<PlayerMmrResponse>(
      `${BASE_URL}/seasons/${seasonId}/players/${playerId}`,
    )
    return response.data
  },

  async getPlayerHistory(seasonId: string, playerId: string): Promise<ClientMmrHistoryEntry[]> {
    const response = await http.get<ClientMmrHistoryEntry[]>(
      `${BASE_URL}/seasons/${seasonId}/players/${playerId}/history`,
    )
    return response.data
  },
}
