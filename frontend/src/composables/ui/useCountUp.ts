import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

const DEFAULT_DURATION_MS = 1200

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Animates a number from `from` to `target` with the same easing the MMR reveal
 * uses, so counters across the app share one feel.
 *
 * Honours prefers-reduced-motion by jumping straight to the final value: a
 * rewind is a long sequence of counters and that is exactly the kind of motion
 * the setting exists to suppress.
 */
export function useCountUp(
  target: Ref<number> | (() => number),
  options: {
    from?: number
    durationMs?: number
    /** Runs the counter while true. Omitted: it runs once on mount. */
    active?: Ref<boolean>
  } = {},
): { value: Ref<number>; start: () => void } {
  const readTarget = typeof target === 'function' ? target : () => target.value
  const duration = options.durationMs ?? DEFAULT_DURATION_MS
  const value = ref(options.from ?? 0)
  let rafId: number | null = null

  function stop(): void {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }

  function start(): void {
    stop()
    const to = readTarget()
    const from = options.from ?? 0

    if (prefersReducedMotion() || from === to) {
      value.value = to
      return
    }

    const startedAt = performance.now()
    function tick(now: number): void {
      const progress = Math.min((now - startedAt) / duration, 1)
      value.value = Math.round(from + (to - from) * easeOutCubic(progress))
      if (progress < 1) rafId = requestAnimationFrame(tick)
      else {
        value.value = to
        rafId = null
      }
    }
    rafId = requestAnimationFrame(tick)
  }

  if (options.active) {
    watch(options.active, (isActive) => (isActive ? start() : stop()), { immediate: true })
  } else {
    onMounted(start)
  }

  onUnmounted(stop)
  return { value, start }
}
