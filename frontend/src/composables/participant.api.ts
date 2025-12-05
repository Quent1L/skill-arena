import http from '@/config/ApiConfig'
import type { JoinTournamentResponse, ParticipantListItem } from '@skill-arena/shared/types/index'

export interface UserSearchResult {
  id: string
  displayName: string
}

export interface ParticipantAPI {
  joinTournament: (tournamentId: string) => Promise<JoinTournamentResponse>
  leaveTournament: (tournamentId: string) => Promise<{ message: string }>
  getTournamentParticipants: (tournamentId: string) => Promise<ParticipantListItem[]>
  addParticipant: (tournamentId: string, userId: string) => Promise<JoinTournamentResponse>
  removeParticipant: (tournamentId: string, userId: string) => Promise<{ message: string }>
  searchUsers: (query: string) => Promise<UserSearchResult[]>
}

export const participantApi: ParticipantAPI = {
  async joinTournament(tournamentId: string) {
    const response = await http.post(`/api/tournaments/${tournamentId}/participants`, {
      tournamentId,
    })
    return response.data
  },

  async leaveTournament(tournamentId: string) {
    const response = await http.delete(`/api/tournaments/${tournamentId}/participants`)
    return response.data
  },

  async getTournamentParticipants(tournamentId: string) {
    const response = await http.get(`/api/tournaments/${tournamentId}/participants`)
    return response.data
  },

  async addParticipant(tournamentId: string, userId: string) {
    const response = await http.post(`/api/tournaments/${tournamentId}/participants/add`, {
      userId,
    })
    return response.data
  },

  async removeParticipant(tournamentId: string, userId: string) {
    const response = await http.delete(`/api/tournaments/${tournamentId}/participants/${userId}`)
    return response.data
  },

  async searchUsers(query: string) {
    const response = await http.get(`/api/tournaments/users/search`, {
      params: { q: query },
    })
    return response.data
  },
}
