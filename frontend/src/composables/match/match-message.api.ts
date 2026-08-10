import http from '@/config/ApiConfig'
import type { ClientMatchMessage } from '@skol-arena/shared/types/index'

const BASE_URL = '/api/matches'

/**
 * Raw API calls to backend - no business logic here
 */
export const matchMessageApi = {
  /**
   * Full discussion thread of a match, oldest message first
   */
  async list(matchId: string): Promise<ClientMatchMessage[]> {
    const response = await http.get<ClientMatchMessage[]>(`${BASE_URL}/${matchId}/messages`)
    return response.data
  },

  /**
   * Post a plain-text message on the thread
   */
  async post(matchId: string, body: string): Promise<ClientMatchMessage> {
    const response = await http.post<ClientMatchMessage>(`${BASE_URL}/${matchId}/messages`, {
      body,
    })
    return response.data
  },
}
