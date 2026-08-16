import { getCurrentInstance, onUnmounted, readonly, ref } from 'vue'

/** How long a run of taps stays alive without a new one. */
const DEFAULT_WINDOW_MS = 1500

/**
 * Unlocks something after N taps in quick succession — the version-number trick.
 *
 * The window is what keeps it from firing by accident: someone idly clicking a
 * label twice a minute apart never gets there, while someone who suspects
 * something is hidden finds it immediately.
 */
export function useSecretTap(
  taps: number,
  onUnlock: () => void,
  options: { windowMs?: number } = {},
) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const count = ref(0)
  let timer: ReturnType<typeof setTimeout> | null = null

  function reset(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
    count.value = 0
  }

  /** Returns true on the tap that unlocked, so callers can skip their own default. */
  function tap(): boolean {
    count.value += 1
    if (count.value >= taps) {
      // Reset before firing: the callback may open something that steals focus,
      // and a stale counter would let the next single tap re-trigger it.
      reset()
      onUnlock()
      return true
    }
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(reset, windowMs)
    return false
  }

  // Guarded so the composable also works standalone, outside a setup().
  if (getCurrentInstance()) onUnmounted(reset)

  return { tap, reset, count: readonly(count) }
}
