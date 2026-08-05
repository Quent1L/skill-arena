import http from '@/config/ApiConfig'
import type {
  RewindArchiveEntry,
  RewindBundle,
  RewindPromotion,
} from '@skol-arena/shared/types/index'

const BASE_URL = '/api/ranked'

export const rewindApi = {
  /** Public global recap of a finished season. */
  async getSeasonRewind(seasonId: string): Promise<RewindBundle> {
    const { data } = await http.get<RewindBundle>(`${BASE_URL}/seasons/${seasonId}/rewind`)
    return data
  },

  /** Global recap plus the caller's own deck, in a single round trip. */
  async getMyRewind(seasonId: string): Promise<RewindBundle> {
    const { data } = await http.get<RewindBundle>(`${BASE_URL}/seasons/${seasonId}/rewind/me`)
    return data
  },

  /** The rewind worth surfacing right now, or null. The window is decided server-side. */
  async getPromoted(): Promise<RewindPromotion | null> {
    const { data } = await http.get<RewindPromotion | null>(`${BASE_URL}/rewinds/promoted`)
    return data
  },

  async listArchive(): Promise<RewindArchiveEntry[]> {
    const { data } = await http.get<RewindArchiveEntry[]>(`${BASE_URL}/rewinds`)
    return data
  },

  async markOpened(seasonId: string): Promise<void> {
    await http.post(`${BASE_URL}/seasons/${seasonId}/rewind/opened`)
  },

  async markViewed(seasonId: string): Promise<void> {
    await http.post(`${BASE_URL}/seasons/${seasonId}/rewind/viewed`)
  },

  async regenerate(seasonId: string): Promise<void> {
    await http.post(`${BASE_URL}/seasons/${seasonId}/rewind/regenerate`)
  },
}
