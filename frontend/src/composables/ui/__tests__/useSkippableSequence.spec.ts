import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useSkippableSequence, type SkippableSequence } from '../useSkippableSequence'

// The composable registers onUnmounted, so it has to live inside a component.
function mountSequence() {
  let sequence!: SkippableSequence
  const wrapper = mount(
    defineComponent({
      setup() {
        sequence = useSkippableSequence()
        return () => null
      },
    }),
  )
  return { wrapper, sequence }
}

function stubReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia
}

const originalMatchMedia = window.matchMedia

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
  vi.useRealTimers()
  window.matchMedia = originalMatchMedia
})

describe('useSkippableSequence', () => {
  it('runs the steps in order, each after its own delay', () => {
    const seen: string[] = []
    const { sequence } = mountSequence()
    sequence.start([
      { delay: 100, run: () => seen.push('a') },
      { delay: 50, run: () => seen.push('b') },
    ])

    expect(seen).toEqual([])
    vi.advanceTimersByTime(100)
    expect(seen).toEqual(['a'])
    vi.advanceTimersByTime(49)
    expect(seen).toEqual(['a'])
    vi.advanceTimersByTime(1)
    expect(seen).toEqual(['a', 'b'])
    expect(sequence.finished.value).toBe(true)
  })

  it('skip plays the rest in order, only once', () => {
    const seen: string[] = []
    const { sequence } = mountSequence()
    sequence.start([
      { delay: 100, run: () => seen.push('a') },
      { delay: 100, run: () => seen.push('b') },
      { delay: 100, run: () => seen.push('c') },
    ])

    vi.advanceTimersByTime(100)
    sequence.skip()
    expect(seen).toEqual(['a', 'b', 'c'])
    expect(sequence.skipped.value).toBe(true)

    // Nothing should replay, neither on a second skip nor as the timers run.
    sequence.skip()
    vi.advanceTimersByTime(1000)
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('cancel drops the remaining steps without playing them', () => {
    const seen: string[] = []
    const { sequence } = mountSequence()
    sequence.start([
      { delay: 100, run: () => seen.push('a') },
      { delay: 100, run: () => seen.push('b') },
    ])

    vi.advanceTimersByTime(100)
    sequence.cancel()
    vi.advanceTimersByTime(1000)
    expect(seen).toEqual(['a'])
  })

  it('unmounting cancels the pending timers', () => {
    const seen: string[] = []
    const { wrapper, sequence } = mountSequence()
    sequence.start([{ delay: 100, run: () => seen.push('a') }])

    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(seen).toEqual([])
  })

  it('with reduced motion, everything plays immediately', () => {
    stubReducedMotion(true)
    const seen: string[] = []
    const { sequence } = mountSequence()
    sequence.start([
      { delay: 1000, run: () => seen.push('a') },
      { delay: 1000, run: () => seen.push('b') },
    ])

    expect(seen).toEqual(['a', 'b'])
    expect(sequence.finished.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
