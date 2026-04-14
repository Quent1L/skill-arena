import http from '@/config/ApiConfig'
import type { PaginatedMatchCards } from '@skill-arena/shared/types/index'

const BASE_URL = '/api/matches'

export const matchHistoryApi = {
  async getPlayerHistory(
    playerId: string,
    params?: { limit?: number; offset?: number; tournamentId?: string },
  ): Promise<PaginatedMatchCards> {
    const response = await http.get<PaginatedMatchCards>(BASE_URL, {
      params: { playerId, ...params },
    })
    return response.data
  },
}
