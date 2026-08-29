import { onScopeDispose, ref, type Ref } from 'vue'

/**
 * Below this, a refresh is over before the eye registers the indicator: flashing a
 * bar for 200ms costs more attention than the information is worth.
 */
export const REFRESH_INDICATOR_DELAY_MS = 400

/** How long the "up to date" confirmation stays after the refresh settles. */
export const REFRESH_DONE_MS = 2000

export interface BackgroundRefresh {
  /** A refresh has been running long enough to be worth announcing. */
  isRefreshing: Ref<boolean>
  /** A refresh that was announced has just finished. */
  justRefreshed: Ref<boolean>
  run<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * Tracks refreshes that happen under the user while they are reading. The data
 * they already have stays on screen throughout: this only reports that it is
 * being replaced, and that the replacement landed.
 *
 * A factory, not a singleton — each store owns its own indicator state.
 */
export function useBackgroundRefresh(): BackgroundRefresh {
  const isRefreshing = ref(false)
  const justRefreshed = ref(false)

  // Concurrent refreshes are the norm here (a visibility change and a WS event can
  // overlap), so the indicator is reference-counted rather than boolean-toggled:
  // the first one in turns it on, the last one out turns it off.
  let pending = 0
  // Set by any refresh in the batch that threw. The error itself is already
  // reported by the xior interceptor; what matters here is not claiming the data
  // was refreshed when it was not.
  let batchFailed = false
  let showTimer: ReturnType<typeof setTimeout> | null = null
  let doneTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
    if (timer) clearTimeout(timer)
    return null
  }

  function start() {
    pending += 1
    if (pending > 1) return
    batchFailed = false
    justRefreshed.value = false
    doneTimer = clearTimer(doneTimer)
    showTimer = setTimeout(() => {
      showTimer = null
      isRefreshing.value = true
    }, REFRESH_INDICATOR_DELAY_MS)
  }

  function settle() {
    pending -= 1
    if (pending > 0) return
    showTimer = clearTimer(showTimer)
    const wasAnnounced = isRefreshing.value
    isRefreshing.value = false
    // Nothing was ever announced, so there is nothing to confirm: a fast refresh
    // stays genuinely invisible. A failed one says nothing either — the data on
    // screen is still the old data.
    if (!wasAnnounced || batchFailed) return
    justRefreshed.value = true
    doneTimer = setTimeout(() => {
      doneTimer = null
      justRefreshed.value = false
    }, REFRESH_DONE_MS)
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    start()
    try {
      return await fn()
    } catch (err) {
      batchFailed = true
      throw err
    } finally {
      settle()
    }
  }

  onScopeDispose(() => {
    showTimer = clearTimer(showTimer)
    doneTimer = clearTimer(doneTimer)
  })

  return { isRefreshing, justRefreshed, run }
}
