import http from '@/config/ApiConfig'
import type {
  ClientBaseTournament,
  ClientCreateTournamentRequest,
  ClientUpdateTournamentRequest,
  TournamentStatus,
  TournamentMode,
} from '@skill-arena/shared/types/index'

const BASE_URL = '/api/tournaments'

// Type alias pour l'API response (ClientBaseTournament - dates converties en Date par l'intercepteur)
export type TournamentResponse = ClientBaseTournament

// Interface pour les filtres de liste (basée sur ListTournamentsQuery du shared)
export interface ListTournamentsFilters {
  status?: TournamentStatus
  mode?: TournamentMode
  createdBy?: string
}

// Type pour le payload de création (avec dates en Date qui seront sérialisées en string)
export type CreateTournamentPayload = ClientCreateTournamentRequest

// Type pour le payload de mise à jour (avec dates en Date qui seront sérialisées en string)
export type UpdateTournamentPayload = ClientUpdateTournamentRequest

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
  async changeStatus(id: string, status: TournamentStatus): Promise<TournamentResponse> {
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
