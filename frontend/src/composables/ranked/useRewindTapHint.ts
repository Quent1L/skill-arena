import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'

/**
 * When to show the "tap here" hint on the mobile deck.
 *
 * Navigation on mobile is a tap on the right quarter of the screen — nothing on
 * the card says so, and arrows on top of a full-screen story would fight the
 * format. So the deck shows a ghost tap instead, and only once the player has
 * actually stalled: a hint that lands while someone is still reading the card
 * competes with the card. Two navigations are enough to prove the gesture is
 * understood; from then on it never comes back, this season or any other.
 */

const STORAGE_KEY = 'skol.rewind.tapHintSeen'

/** How long a player may stare at a card before the hint offers a way forward. */
export const REWIND_HINT_IDLE_MS = 6000

/** Navigations after which the gesture counts as learned. */
const LEARNED_AFTER = 2

export interface RewindTapHintOptions {
  /** Mobile only: on desktop the footer arrows already say it. */
  enabled: Ref<boolean> | ComputedRef<boolean>
  index: Ref<number> | ComputedRef<number>
  idleMs?: number
}

export interface RewindTapHint {
  visible: ComputedRef<boolean>
  /** Called on every deck move, whatever triggered it — tap, swipe or key. */
  notifyNavigation: () => void
}

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Private mode or a blocked store: the hint simply behaves as if unseen.
    return false
  }
}

function persistSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Nothing to do: the hint stays a per-session affair.
  }
}

export function useRewindTapHint(options: RewindTapHintOptions): RewindTapHint {
  const idleMs = options.idleMs ?? REWIND_HINT_IDLE_MS
  const learned = ref(readSeen())
  const idle = ref(false)
  let navigations = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const visible = computed(() => options.enabled.value && !learned.value && idle.value)

  function armIdleTimer(): void {
    if (timer) clearTimeout(timer)
    timer = null
    idle.value = false
    if (learned.value || !options.enabled.value) return
    timer = setTimeout(() => (idle.value = true), idleMs)
  }

  function notifyNavigation(): void {
    navigations++
    if (navigations >= LEARNED_AFTER) {
      learned.value = true
      persistSeen()
    }
    armIdleTimer()
  }

  // Any change of card restarts the wait, including the ones the composable is
  // not told about (keyboard, a card advancing on its own).
  watch(() => [options.enabled.value, options.index.value], armIdleTimer, { immediate: true })
  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  return { visible, notifyNavigation }
}
