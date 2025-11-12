import http from '@/config/ApiConfig'
import type {
  Match,
  CreateMatchRequestData,
  UpdateMatchRequestData,
  ReportMatchResultRequestData,
  ConfirmMatchResultRequestData,
  ValidateMatchRequestData,
} from '@skill-arena/shared'

const BASE_URL = '/api/matches'

// Type alias pour l'API response
export type MatchResponse = Match

// Types pour les payloads
export type CreateMatchPayload = CreateMatchRequestData
export type UpdateMatchPayload = UpdateMatchRequestData
export type ReportMatchResultPayload = ReportMatchResultRequestData
export type ConfirmMatchResultPayload = ConfirmMatchResultRequestData
export type ValidateMatchPayload = ValidateMatchRequestData

/**
 * Raw API calls to backend - no business logic here
 */
export const matchApi = {
  /**
   * Create a new match
   */
  async create(payload: CreateMatchPayload): Promise<MatchResponse> {
    const response = await http.post<MatchResponse>(BASE_URL, payload)
    return response.data
  },

  /**
   * List matches with optional filters
   */
  async list(filters?: ListMatchesFilters): Promise<MatchResponse[]> {
    const response = await http.get<MatchResponse[]>(BASE_URL, {
      params: filters,
    })
    return response.data
  },

  /**
   * Get match by ID
   */
  async getById(id: string): Promise<MatchResponse> {
    const response = await http.get<MatchResponse>(`${BASE_URL}/${id}`)
    return response.data
  },

  /**
   * Update match
   */
  async update(id: string, payload: UpdateMatchPayload): Promise<MatchResponse> {
    const response = await http.patch<MatchResponse>(`${BASE_URL}/${id}`, payload)
    return response.data
  },

  /**
   * Delete match
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await http.delete<{ success: boolean; message: string }>(`${BASE_URL}/${id}`)
    return response.data
  },

  /**
   * Report match result
   */
  async reportResult(id: string, payload: ReportMatchResultPayload): Promise<MatchResponse> {
    const response = await http.post<MatchResponse>(`${BASE_URL}/${id}/report`, payload)
    return response.data
  },

  /**
   * Confirm match result
   */
  async confirmResult(id: string, payload: ConfirmMatchResultPayload): Promise<MatchResponse> {
    const response = await http.post<MatchResponse>(`${BASE_URL}/${id}/confirm`, payload)
    return response.data
  },

  /**
   * Validate match possibility
   */
  async validate(payload: ValidateMatchPayload): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const response = await http.post<{
      valid: boolean
      errors: string[]
      warnings: string[]
    }>(`${BASE_URL}/validate`, payload)
    return response.data
  },
}
