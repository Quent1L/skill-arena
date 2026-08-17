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
  makeTier({ level: 2, name: 'Argent', minMmr: 900 }),
  makeTier({ level: 3, name: 'Or', minMmr: 1100 }),
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
  it('un clic saute à l’état final : MMR final et bouton Continuer', async () => {
    mountReveal({ mmrBefore: 1000, mmrAfter: 1032, mmrDelta: 32 })

    expect(counter()).toBe('1000')
    expect(continueBtn()).toBeUndefined()

    backdrop().click()
    await nextTick()

    expect(counter()).toBe('1032')
    expect(continueBtn()).toBeDefined()
  })

  it('un second clic sur le fond ne ferme pas la carte', async () => {
    const wrapper = mountReveal({ mmrBefore: 1000, mmrAfter: 1032, mmrDelta: 32 })

    backdrop().click()
    await nextTick()
    backdrop().click()
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('seul le bouton Continuer émet close', async () => {
    const wrapper = mountReveal({ mmrBefore: 1000, mmrAfter: 1032, mmrDelta: 32 })

    backdrop().click()
    await nextTick()
    continueBtn()!.click()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('montée de rang : le badge du tier quitté est affiché avant celui du nouveau', async () => {
    mountReveal({
      mmrBefore: 1080,
      mmrAfter: 1120,
      mmrDelta: 40,
      tierBeforeLevel: 2,
      tierAfterLevel: 3,
      tierBeforeName: 'Argent',
      tierAfterName: 'Or',
      rankChanged: true,
    })

    vi.advanceTimersByTime(ENTRY_MS)
    await nextTick()
    expect(bodyText()).toContain('Argent')
    expect(bodyText()).not.toContain('mmrRevealAnimation.rankUp')

    // Le premier segment atteint la limite du tier, puis le badge bascule.
    vi.advanceTimersByTime(SEGMENT_MS + FLASH_MS)
    await nextTick()
    await nextTick()
    expect(bodyText()).toContain('Or')
    expect(bodyText()).toContain('mmrRevealAnimation.rankUp')
  })

  it('montée de rang : la première barre se remplit à fond avant que la seconde reparte de zéro', async () => {
    mountReveal({
      mmrBefore: 1080, // Argent 900-1100 → 90 %
      mmrAfter: 1120, // Or 1100-1300 → 10 %
      mmrDelta: 40,
      tierBeforeLevel: 2,
      tierAfterLevel: 3,
      rankChanged: true,
    })

    // Premier segment : la base reste à 90 %, le delta comble jusqu'à 100 %.
    vi.advanceTimersByTime(ENTRY_MS + RAF_MS)
    await nextTick()
    expect(fillStyle('base').width).toBe('90%')
    expect(fillStyle('delta')).toMatchObject({ left: '90%', width: '10%' })
    expect(fillStyle('delta').transition).toContain(`${SEGMENT_MS}ms`)

    // Bascule de tier : le retour à gauche doit être sec. Sans cela la barre
    // rejouerait 100 % → 0 % en transition et se lirait comme une vidange.
    // Pile sur la bascule, sans laisser tourner les deux frames de reprise.
    vi.advanceTimersByTime(SEGMENT_MS + FLASH_MS + SWAP_MS - RAF_MS)
    await nextTick()
    expect(fillStyle('base')).toMatchObject({ width: '0%', transition: 'none' })
    expect(fillStyle('delta')).toMatchObject({ left: '0%', width: '0%', transition: 'none' })

    // Puis seule la progression du nouveau tier est animée.
    vi.advanceTimersByTime(RAF_MS)
    await nextTick()
    expect(fillStyle('delta')).toMatchObject({ left: '0%', width: '10%' })
    expect(fillStyle('delta').transition).toContain(`${SEGMENT_MS}ms`)
  })

  it('les bornes de la barre ne répètent pas le nom du tier, déjà en badge au-dessus', async () => {
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
    expect(labels).not.toContain('Argent')
    // Le badge, lui, le porte toujours.
    expect(bodyText()).toContain('Argent')
  })

  it('descente de rang : libellé de descente une fois le badge basculé', async () => {
    mountReveal({
      mmrBefore: 1120,
      mmrAfter: 1080,
      mmrDelta: -40,
      tierBeforeLevel: 3,
      tierAfterLevel: 2,
      tierBeforeName: 'Or',
      tierAfterName: 'Argent',
      rankChanged: true,
    })

    backdrop().click()
    await nextTick()

    expect(counter()).toBe('1080')
    expect(bodyText()).toContain('mmrRevealAnimation.rankDown')
  })

  it('un événement de placement reste sur une barre rayée, sans changement de rang', async () => {
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

  it('aucun timer ne survit au démontage', () => {
    const wrapper: VueWrapper = mountReveal({ mmrBefore: 1000, mmrAfter: 1032, mmrDelta: 32 })

    expect(vi.getTimerCount()).toBeGreaterThan(0)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
