import api from '@/config/ApiConfig'
import type { MmrAnimationEventResponse, BadgeAnimationResponse } from '@skol-arena/shared'

export const mmrAnimationEventApi = {
  async fetchPendingEvents(seasonId: string): Promise<{ events: MmrAnimationEventResponse[] }> {
    const { data } = await api.get(`/api/ranked/seasons/${seasonId}/animation-events/pending`)
    return data
  },

  async markEventsViewed(seasonId: string, ids: string[]): Promise<void> {
    await api.post(`/api/ranked/seasons/${seasonId}/animation-events/mark-viewed`, { ids })
  },

  async fetchPendingBadges(seasonId: string): Promise<{ badges: BadgeAnimationResponse[] }> {
    const { data } = await api.get(`/api/ranked/seasons/${seasonId}/badge-animations/pending`)
    return data
  },

  async markBadgesViewed(seasonId: string, ids: string[]): Promise<void> {
    await api.post(`/api/ranked/seasons/${seasonId}/badge-animations/mark-viewed`, { ids })
  },
}
