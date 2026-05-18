import { ref, computed } from 'vue'
import { mmrAnimationEventApi } from './mmr-animation-event.api'
import type { MmrAnimationEventResponse, MmrAnimationWsPayload } from '@skill-arena/shared'

export function useMMrAnimationQueue() {
  const queue = ref<MmrAnimationEventResponse[]>([])
  const seasonIdRef = ref<string | null>(null)

  const currentEvent = computed(() => queue.value[0] ?? null)
  const showRecap = computed(() => queue.value.length >= 2)

  async function loadPending(seasonId: string) {
    seasonIdRef.value = seasonId
    try {
      const { events } = await mmrAnimationEventApi.fetchPendingEvents(seasonId)
      queue.value = deduplicateEvents(events)
    } catch {
      // Silent fail — animation is non-critical
    }
  }

  function enqueue(payload: MmrAnimationWsPayload) {
    const { tournamentId: _t, ...event } = payload
    const idIdx = queue.value.findIndex((e) => e.id === event.id)
    if (idIdx !== -1) {
      queue.value.splice(idIdx, 1, event)
      return
    }
    const matchIdx = queue.value.findIndex((e) => e.matchId === event.matchId)
    if (matchIdx !== -1 && event.eventType === 'official') {
      queue.value.splice(matchIdx, 1, event)
    } else if (matchIdx === -1) {
      queue.value.push(event)
    }
  }

  async function acknowledgeCurrentEvent() {
    const event = queue.value[0]
    if (!event || !seasonIdRef.value) return
    queue.value.shift()
    try {
      await mmrAnimationEventApi.markEventsViewed(seasonIdRef.value, [event.id])
    } catch {
      // Silent fail
    }
  }

  async function dismissAll() {
    if (!seasonIdRef.value || queue.value.length === 0) return
    const ids = queue.value.map((e) => e.id)
    queue.value = []
    try {
      await mmrAnimationEventApi.markEventsViewed(seasonIdRef.value, ids)
    } catch {
      // Silent fail
    }
  }

  return { queue, currentEvent, showRecap, loadPending, enqueue, acknowledgeCurrentEvent, dismissAll }
}

function deduplicateEvents(events: MmrAnimationEventResponse[]): MmrAnimationEventResponse[] {
  const byMatch = new Map<string, MmrAnimationEventResponse>()
  for (const e of events) {
    const existing = byMatch.get(e.matchId)
    if (!existing || e.eventType === 'official') {
      byMatch.set(e.matchId, e)
    }
  }
  return [...byMatch.values()].sort(
    (a, b) => new Date(a.playedAt ?? a.createdAt).getTime() - new Date(b.playedAt ?? b.createdAt).getTime(),
  )
}
