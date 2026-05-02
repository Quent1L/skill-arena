import api from '@/config/ApiConfig'
import type { MmrAnimationEventResponse } from '@skill-arena/shared'

export const mmrAnimationEventApi = {
  async fetchPendingEvents(seasonId: string): Promise<{ events: MmrAnimationEventResponse[] }> {
    const { data } = await api.get(`/api/ranked/seasons/${seasonId}/animation-events/pending`)
    return data
  },

  async markEventsViewed(seasonId: string, ids: string[]): Promise<void> {
    await api.post(`/api/ranked/seasons/${seasonId}/animation-events/mark-viewed`, { ids })
  },
}
