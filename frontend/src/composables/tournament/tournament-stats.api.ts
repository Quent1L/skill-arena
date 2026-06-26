import http from '@/config/ApiConfig'
import type { TournamentStats } from '@skol-arena/shared'

const BASE_URL = '/api/tournaments'

export const tournamentStatsApi = {
  async getStats(tournamentId: string): Promise<TournamentStats> {
    const response = await http.get<TournamentStats>(`${BASE_URL}/${tournamentId}/stats`)
    return response.data
  },
}
