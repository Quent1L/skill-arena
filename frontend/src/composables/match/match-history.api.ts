import http from '@/config/ApiConfig'
import type { ClientMatchHistoryEntry, PlayerMatchHistoryQuery } from '@skill-arena/shared/types/index'

const BASE_URL = '/api/users'

export const matchHistoryApi = {
  async getPlayerHistory(
    playerId: string,
    params?: PlayerMatchHistoryQuery,
  ): Promise<ClientMatchHistoryEntry[]> {
    const response = await http.get<ClientMatchHistoryEntry[]>(
      `${BASE_URL}/${playerId}/match-history`,
      { params },
    )
    return response.data
  },
}
