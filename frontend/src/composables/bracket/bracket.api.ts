import http from '@/config/ApiConfig'
import type {
  ClientBracketData,
  GenerateBracketInput,
  CanGenerateBracketResponse,
} from '@skill-arena/shared/types/index'

const BASE_URL = '/api/tournaments'

/**
 * Raw API calls to backend - no business logic here
 */
export const bracketApi = {
  /**
   * Generate or regenerate bracket for a tournament
   */
  async generate(tournamentId: string, payload: GenerateBracketInput): Promise<ClientBracketData> {
    const response = await http.post<ClientBracketData>(
      `${BASE_URL}/${tournamentId}/bracket`,
      payload,
    )
    return response.data
  },

  /**
   * Get bracket data for a tournament
   */
  async getBracket(tournamentId: string): Promise<ClientBracketData> {
    const response = await http.get<ClientBracketData>(`${BASE_URL}/${tournamentId}/bracket`)
    return response.data
  },

  /**
   * Check if bracket can be generated/regenerated
   */
  async canGenerate(tournamentId: string): Promise<CanGenerateBracketResponse> {
    const response = await http.get<CanGenerateBracketResponse>(
      `${BASE_URL}/${tournamentId}/bracket/can-generate`,
    )
    return response.data
  },

  /**
   * Delete bracket and all associated matches
   */
  async deleteBracket(tournamentId: string): Promise<void> {
    await http.delete(`${BASE_URL}/${tournamentId}/bracket`)
  },
}
