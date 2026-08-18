import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { MmrAnimationEventResponse } from '@skol-arena/shared'
import { makeMmrEvent, makeTier } from '@/test-support/factories'
import { MMR_REVEAL_TIMING } from '@/composables/ranked/useMmrBarPlayback'
import MmrRevealAnimation from '../MmrRevealAnimation.vue'

// t echoes the key, so assertions can name the key rather than a translation.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const TIERS = [
  makeTier({ level: 1, name: 'Bronze', minMmr: 700 }),
  makeTier({ level: 2, name: 'Silver', minMmr: 900 }),
  makeTier({ level: 3, name: 'Gold', minMmr: 1100 }),
]

// Imported, not copied: the component reads the very same beats.
const {
  entry: ENTRY_MS,
  segment: SEGMENT_MS,
  flash: FLASH_MS,
  swap: SWAP_MS,
} = MMR_REVEAL_TIMING
/** Enough to flush the two frames the bar waits before it starts travelling. */
const RAF_MS = 50

function mountReveal(over: Partial<MmrAnimationEventResponse> = {}) {
  return mount(MmrRevealAnimation, {
    props: { event: makeMmrEvent(over), tiers: TIERS },
  })
}

// The component teleports to <body>, so every query goes through the document.
const backdrop = () => document.body.querySelector('.reveal-backdrop') as HTMLElement
const counter = () => document.body.querySelector('[data-testid="mmr-counter"]')?.textContent?.trim()
const continueBtn = () =>
  [...document.body.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('mmrRevealAnimation.continue'),
  )
const bodyText = () => document.body.textContent ?? ''
// CSSStyleDeclaration is a live host object, so pull the handful of properties
// the assertions care about into a plain snapshot.
const fillStyle = (part: 'base' | 'delta') => {
  const { style } = document.body.querySelector(`.fill.${part}`) as HTMLElement
  return { left: style.left, width: style.width, transition: style.transition }
}

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('MmrRevealAnimation', () => {
  it('one click jumps to the final state: final MMR and Continue button', async () => {
    mountReveal({ mmrBefore: 1000, mmrAfter: 1032, mmrDelta: 32 })

    expect(counter()).toBe('1000')
    expect(continueBtn()).toBeUndefined()

    backdrop().click()
    await nextTick()

    expect(counter()).toBe('1032')
    expect(continueBtn()).toBeDefined()
  })

  it('a second click on the backdrop does not close the card', async () => {
    const wrapper = mountReveal({ mmrBefore: 1000, mmrAfter: 1032, mmrDelta: 32 })

    backdrop().click()
    await nextTick()
    backdrop().click()
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('only the Continue button emits close', async () => {
    const wrapper = mountReveal({ mmrBefore: 1000, mmrAfter: 1032, mmrDelta: 32 })

    backdrop().click()
    await nextTick()
    continueBtn()!.click()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('rank up: the badge of the tier left is shown before the new one', async () => {
    mountReveal({
      mmrBefore: 1080,
      mmrAfter: 1120,
      mmrDelta: 40,
      tierBeforeLevel: 2,
      tierAfterLevel: 3,
      tierBeforeName: 'Silver',
      tierAfterName: 'Gold',
      rankChanged: true,
    })

    vi.advanceTimersByTime(ENTRY_MS)
    await nextTick()
    expect(bodyText()).toContain('Silver')
    expect(bodyText()).not.toContain('mmrRevealAnimation.rankUp')

    // The first segment reaches the tier limit, then the badge switches over.
    vi.advanceTimersByTime(SEGMENT_MS + FLASH_MS)
    await nextTick()
    await nextTick()
    expect(bodyText()).toContain('Gold')
    expect(bodyText()).toContain('mmrRevealAnimation.rankUp')
  })

  it('rank up: the first bar fills all the way before the second starts over at zero', async () => {
    mountReveal({
      mmrBefore: 1080, // Silver 900-1100 → 90%
      mmrAfter: 1120, // Gold 1100-1300 → 10%
      mmrDelta: 40,
      tierBeforeLevel: 2,
      tierAfterLevel: 3,
      rankChanged: true,
    })

    // First segment: the base stays at 90%, the delta fills up to 100%.
    vi.advanceTimersByTime(ENTRY_MS + RAF_MS)
    await nextTick()
    expect(fillStyle('base').width).toBe('90%')
    expect(fillStyle('delta')).toMatchObject({ left: '90%', width: '10%' })
    expect(fillStyle('delta').transition).toContain(`${SEGMENT_MS}ms`)

    // Tier switch: the snap back to the left must be instant. Otherwise the bar
    // would replay 100% → 0% with a transition and read like a drain animation.
    // Right on the switch, without letting the two resume frames run.
    vi.advanceTimersByTime(SEGMENT_MS + FLASH_MS + SWAP_MS - RAF_MS)
    await nextTick()
    expect(fillStyle('base')).toMatchObject({ width: '0%', transition: 'none' })
    expect(fillStyle('delta')).toMatchObject({ left: '0%', width: '0%', transition: 'none' })

    // Then only the new tier's progress is animated.
    vi.advanceTimersByTime(RAF_MS)
    await nextTick()
    expect(fillStyle('delta')).toMatchObject({ left: '0%', width: '10%' })
    expect(fillStyle('delta').transition).toContain(`${SEGMENT_MS}ms`)
  })

  it('the bar’s bounds do not repeat the tier name, already shown in the badge above', async () => {
    mountReveal({
      mmrBefore: 1000,
      mmrAfter: 1032,
      mmrDelta: 32,
      tierBeforeLevel: 2,
      tierAfterLevel: 2,
    })

    backdrop().click()
    await nextTick()

    const labels = document.body.querySelector('.bar-labels')?.textContent ?? ''
    expect(labels).toContain('900')
    expect(labels).not.toContain('Silver')
    // The badge, though, always carries it.
    expect(bodyText()).toContain('Silver')
  })

  it('rank down: the down label shows once the badge has switched', async () => {
    mountReveal({
      mmrBefore: 1120,
      mmrAfter: 1080,
      mmrDelta: -40,
      tierBeforeLevel: 3,
      tierAfterLevel: 2,
      tierBeforeName: 'Gold',
      tierAfterName: 'Silver',
      rankChanged: true,
    })

    backdrop().click()
    await nextTick()

    expect(counter()).toBe('1080')
    expect(bodyText()).toContain('mmrRevealAnimation.rankDown')
  })

  it('a placement event stays on a striped bar, with no rank change', async () => {
    mountReveal({
      eventType: 'provisional',
      mmrBefore: 1000,
      mmrAfter: 1030,
      mmrDelta: 30,
      tierAfterLevel: 2,
    })

    backdrop().click()
    await nextTick()

    const base = document.body.querySelector('.fill.base') as HTMLElement
    expect(base.style.background).toContain('repeating-linear-gradient')
    expect(bodyText()).not.toContain('mmrRevealAnimation.rankUp')
  })

  it('no timer survives unmounting', () => {
    const wrapper: VueWrapper = mountReveal({ mmrBefore: 1000, mmrAfter: 1032, mmrDelta: 32 })

    expect(vi.getTimerCount()).toBeGreaterThan(0)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
