import { onUnmounted, ref, type Ref } from 'vue'
import { prefersReducedMotion } from './reduced-motion'

export interface SequenceStep {
  /** Delay after the previous step, in ms. */
  delay: number
  run: () => void
}

export interface SkippableSequence {
  start: (steps: SequenceStep[]) => void
  /** Runs every step still pending, in order, right now. */
  skip: () => void
  /** Drops every step still pending without running it. */
  cancel: () => void
  skipped: Ref<boolean>
  finished: Ref<boolean>
}

/**
 * A chain of timed steps that can be jumped to its end. Holding the pending
 * steps rather than firing a `setTimeout` per step up front is what makes both
 * skipping and a clean unmount possible — a fire-and-forget chain has no handle
 * to cancel and keeps mutating a component that is already gone.
 *
 * Under `prefers-reduced-motion` the whole chain runs synchronously, the same
 * way `useCountUp` collapses to its final value.
 */
export function useSkippableSequence(): SkippableSequence {
  const skipped = ref(false)
  const finished = ref(false)
  let pending: SequenceStep[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function drain(): void {
    const steps = pending
    pending = []
    for (const step of steps) step.run()
    finished.value = true
  }

  function scheduleNext(): void {
    const step = pending[0]
    if (!step) {
      finished.value = true
      return
    }
    timer = setTimeout(() => {
      timer = null
      pending.shift()
      step.run()
      scheduleNext()
    }, step.delay)
  }

  function start(steps: SequenceStep[]): void {
    clearTimer()
    skipped.value = false
    finished.value = false
    pending = [...steps]
    if (prefersReducedMotion()) {
      drain()
      return
    }
    scheduleNext()
  }

  function skip(): void {
    if (finished.value) return
    clearTimer()
    skipped.value = true
    drain()
  }

  function cancel(): void {
    clearTimer()
    pending = []
  }

  onUnmounted(cancel)

  return { start, skip, cancel, skipped, finished }
}
