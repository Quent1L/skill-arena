import http from '@/config/ApiConfig'

const BASE_URL = '/api/tournaments'

export interface TournamentResponse {
  id: string
  name: string
  description?: string
  mode: 'championship' | 'bracket'
  teamMode: 'static' | 'flex'
  teamSize: number
  maxMatchesPerPlayer: number
  maxTimesWithSamePartner: number
  maxTimesWithSameOpponent: number
  pointPerVictory: number | null
  pointPerDraw: number | null
  pointPerLoss: number | null
  allowDraw: boolean | null
  startDate: Date
  endDate: Date
  status: 'draft' | 'open' | 'ongoing' | 'finished'
  createdBy: string
  createdAt: Date
  creator?: {
    id: string
    displayName: string
    role: 'player' | 'tournament_admin' | 'super_admin'
  }
  admins?: Array<{
    id: string
    role: 'owner' | 'co_admin'
    user: {
      id: string
      displayName: string
    }
  }>
}

export interface CreateTournamentPayload {
  name: string
  description?: string
  mode: 'championship' | 'bracket'
  teamMode: 'static' | 'flex'
  teamSize: number
  maxMatchesPerPlayer?: number
  maxTimesWithSamePartner?: number
  maxTimesWithSameOpponent?: number
  pointPerVictory?: number
  pointPerDraw?: number
  pointPerLoss?: number
  allowDraw?: boolean
  startDate: string
  endDate: string
}

export interface UpdateTournamentPayload {
  name?: string
  description?: string
  mode?: 'championship' | 'bracket'
  teamMode?: 'static' | 'flex'
  teamSize?: number
  maxMatchesPerPlayer?: number
  maxTimesWithSamePartner?: number
  maxTimesWithSameOpponent?: number
  pointPerVictory?: number
  pointPerDraw?: number
  pointPerLoss?: number
  allowDraw?: boolean
  startDate?: string
  endDate?: string
  status?: 'draft' | 'open' | 'ongoing' | 'finished'
}

export interface ListTournamentsFilters {
  status?: 'draft' | 'open' | 'ongoing' | 'finished'
  mode?: 'championship' | 'bracket'
  createdBy?: string
}

/**
 * Raw API calls to backend - no business logic here
 */
export const tournamentApi = {
  /**
   * List all tournaments with optional filters
   */
  async list(filters?: ListTournamentsFilters): Promise<TournamentResponse[]> {
    const response = await http.get<TournamentResponse[]>(BASE_URL, {
      params: filters,
    })
    return response.data
  },

  /**
   * Get tournament by ID
   */
  async getById(id: string): Promise<TournamentResponse> {
    const response = await http.get<TournamentResponse>(`${BASE_URL}/${id}`)
    return response.data
  },

  /**
   * Create a new tournament
   */
  async create(payload: CreateTournamentPayload): Promise<TournamentResponse> {
    const response = await http.post<TournamentResponse>(BASE_URL, payload)
    return response.data
  },

  /**
   * Update tournament
   */
  async update(id: string, payload: UpdateTournamentPayload): Promise<TournamentResponse> {
    const response = await http.patch<TournamentResponse>(`${BASE_URL}/${id}`, payload)
    return response.data
  },

  /**
   * Change tournament status
   */
  async changeStatus(
    id: string,
    status: 'draft' | 'open' | 'ongoing' | 'finished',
  ): Promise<TournamentResponse> {
    const response = await http.patch<TournamentResponse>(`${BASE_URL}/${id}/status`, { status })
    return response.data
  },

  /**
   * Delete tournament
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await http.delete<{ success: boolean; message: string }>(`${BASE_URL}/${id}`)
    return response.data
  },
}
