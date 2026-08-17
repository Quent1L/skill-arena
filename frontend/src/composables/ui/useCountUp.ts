import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { prefersReducedMotion } from './reduced-motion'

const DEFAULT_DURATION_MS = 1200

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Per-run overrides, for a counter replayed across several legs. */
export interface CountUpRun {
  from?: number
  to?: number
  durationMs?: number
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
    /** Never starts on its own — the caller drives every run through `start()`. */
    manual?: boolean
  } = {},
): { value: Ref<number>; start: (run?: CountUpRun) => void; finish: () => void } {
  const readTarget = typeof target === 'function' ? target : () => target.value
  const value = ref(options.from ?? 0)
  let rafId: number | null = null
  let pendingTo: number | null = null

  function stop(): void {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }

  function start(run: CountUpRun = {}): void {
    stop()
    const to = run.to ?? readTarget()
    const from = run.from ?? options.from ?? 0
    const duration = run.durationMs ?? options.durationMs ?? DEFAULT_DURATION_MS
    pendingTo = to

    if (prefersReducedMotion() || from === to || duration <= 0) {
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

  /** Cancels the run in flight and snaps to its target — used when skipping. */
  function finish(): void {
    stop()
    value.value = pendingTo ?? readTarget()
  }

  if (options.active) {
    watch(options.active, (isActive) => (isActive ? start() : stop()), { immediate: true })
  } else if (!options.manual) {
    onMounted(() => start())
  }

  onUnmounted(stop)
  return { value, start, finish }
}
