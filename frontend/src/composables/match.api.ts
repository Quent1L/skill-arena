import http from '@/config/ApiConfig'
import type {
  Match,
  CreateMatchRequestData,
  UpdateMatchRequestData,
  ReportMatchResultRequestData,
  ConfirmMatchResultRequestData,
  ValidateMatchRequestData,
  ListMatchesQuery,
} from '@skill-arena/shared/types/index'

const BASE_URL = '/api/matches'

/**
 * Raw API calls to backend - no business logic here
 */
export const matchApi = {
  /**
   * Create a new match
   */
  async create(payload: CreateMatchRequestData): Promise<Match> {
    const response = await http.post<Match>(BASE_URL, payload)
    return response.data
  },

  /**
   * List matches with optional filters
   */
  async list(filters?: ListMatchesQuery): Promise<Match[]> {
    const response = await http.get<Match[]>(BASE_URL, {
      params: filters,
    })
    return response.data
  },

  /**
   * Get match by ID
   */
  async getById(id: string): Promise<Match> {
    const response = await http.get<Match>(`${BASE_URL}/${id}`)
    return response.data
  },

  /**
   * Update match
   */
  async update(id: string, payload: UpdateMatchRequestData): Promise<Match> {
    const response = await http.patch<Match>(`${BASE_URL}/${id}`, payload)
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
  async reportResult(id: string, payload: ReportMatchResultRequestData): Promise<Match> {
    const response = await http.post<Match>(`${BASE_URL}/${id}/report`, payload)
    return response.data
  },

  /**
   * Confirm match result
   */
  async confirmResult(id: string, payload: ConfirmMatchResultRequestData): Promise<Match> {
    const response = await http.post<Match>(`${BASE_URL}/${id}/confirm`, payload)
    return response.data
  },

  /**
   * Validate match possibility
   */
  async validate(payload: ValidateMatchRequestData): Promise<{
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
