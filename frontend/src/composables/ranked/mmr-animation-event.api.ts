import api from '@/config/ApiConfig'
import type {
  MmrAnimationEventResponse,
  BadgeAnimationResponse,
  RuleFiringSurface,
} from '@skol-arena/shared'

export const mmrAnimationEventApi = {
  async fetchPendingEvents(seasonId: string): Promise<{ events: MmrAnimationEventResponse[] }> {
    const { data } = await api.get(`/api/ranked/seasons/${seasonId}/animation-events/pending`)
    return data
  },

  async markEventsViewed(
    seasonId: string,
    ids: string[],
    surface?: RuleFiringSurface,
  ): Promise<void> {
    await api.post(`/api/ranked/seasons/${seasonId}/animation-events/mark-viewed`, { ids, surface })
  },

  async fetchPendingBadges(seasonId: string): Promise<{ badges: BadgeAnimationResponse[] }> {
    const { data } = await api.get(`/api/ranked/seasons/${seasonId}/badge-animations/pending`)
    return data
  },

  async markBadgesViewed(seasonId: string, ids: string[]): Promise<void> {
    await api.post(`/api/ranked/seasons/${seasonId}/badge-animations/mark-viewed`, { ids })
  },
}
