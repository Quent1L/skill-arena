import { describe, it, expect, vi, afterEach } from 'vitest'
import { useSecretTap } from '../useSecretTap'

afterEach(() => {
  vi.useRealTimers()
})

describe('useSecretTap', () => {
  it('unlocks on the nth tap and not before', () => {
    const onUnlock = vi.fn()
    const { tap } = useSecretTap(5, onUnlock)

    for (let i = 0; i < 4; i += 1) expect(tap()).toBe(false)
    expect(onUnlock).not.toHaveBeenCalled()

    expect(tap()).toBe(true)
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('starts over once the window lapses between taps', () => {
    vi.useFakeTimers()
    const onUnlock = vi.fn()
    const { tap, count } = useSecretTap(3, onUnlock, { windowMs: 1000 })

    tap()
    tap()
    expect(count.value).toBe(2)

    vi.advanceTimersByTime(1001)
    expect(count.value).toBe(0)

    tap()
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('keeps the run alive as long as taps stay inside the window', () => {
    vi.useFakeTimers()
    const onUnlock = vi.fn()
    const { tap } = useSecretTap(3, onUnlock, { windowMs: 1000 })

    tap()
    vi.advanceTimersByTime(900)
    tap()
    vi.advanceTimersByTime(900)
    tap()

    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  // The counter is cleared before the callback runs, so whatever it opens cannot
  // be re-triggered by a single stray tap afterwards.
  it('requires a full run again after unlocking', () => {
    const onUnlock = vi.fn()
    const { tap, count } = useSecretTap(2, onUnlock)

    tap()
    tap()
    expect(onUnlock).toHaveBeenCalledTimes(1)
    expect(count.value).toBe(0)

    tap()
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })
})
