import http from '@/config/ApiConfig'
import type { ClientMatchModel } from '@skill-arena/shared/types/index'

const BASE_URL = '/api/tournaments'

export type BracketType = 'single' | 'double'

export interface BracketResponse {
  tournamentId: string
  matches: ClientMatchModel[]
  totalMatches: number
}

export interface GenerateBracketResponse {
  success: boolean
  bracketType: BracketType
  matchesCreated: number
  message: string
}

/**
 * Raw API calls for bracket operations
 */
export const bracketApi = {
  /**
   * Get bracket structure for a tournament
   */
  async getBracket(tournamentId: string): Promise<BracketResponse> {
    const response = await http.get<BracketResponse>(`${BASE_URL}/${tournamentId}/bracket`)
    return response.data
  },

  /**
   * Generate bracket for a tournament (admin only)
   */
  async generateBracket(
    tournamentId: string,
    bracketType: BracketType,
  ): Promise<GenerateBracketResponse> {
    const response = await http.post<GenerateBracketResponse>(
      `${BASE_URL}/${tournamentId}/generate-bracket`,
      { bracketType },
    )
    return response.data
  },
}
