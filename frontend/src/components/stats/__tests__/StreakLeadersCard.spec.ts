import { describe, it, expect, vi } from 'vitest'
import type { WinStreakEntry } from '@skol-arena/shared'
import { mountWithPrime } from '@/test-support/mount'
import StreakLeadersCard from '../StreakLeadersCard.vue'

// t() echoes the key, plus the interpolated count when there is one, so assertions can
// check both the wording used and the number fed to it.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: number }) => (params ? `${key}:${params.count}` : key),
  }),
}))

function entry(overrides: Partial<WinStreakEntry> = {}): WinStreakEntry {
  return {
    playerId: 'p1',
    displayName: 'Thomas',
    shortName: 'THO',
    currentStreak: 5,
    ...overrides,
  }
}

function entries(count: number): WinStreakEntry[] {
  return Array.from({ length: count }, (_, i) =>
    entry({ playerId: `p${i}`, displayName: `Player ${i}`, currentStreak: count - i }),
  )
}

function mountCard(items: WinStreakEntry[], props: Record<string, unknown> = {}) {
  return mountWithPrime(StreakLeadersCard, {
    props: {
      title: 'Win streaks',
      icon: 'fa fa-fire',
      variant: 'orange' as const,
      entries: items,
      unitLabel: 'consecutive wins',
      ...props,
    },
  })
}

describe('StreakLeadersCard', () => {
  it('collapses to the first three entries and offers to expand the rest', () => {
    const wrapper = mountCard(entries(5))

    const rows = wrapper.findAll('.space-y-2 > div')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('Player 0')
    expect(wrapper.text()).not.toContain('Player 3')

    const button = wrapper.get('button')
    expect(button.text()).toContain('common.showMore:2')
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('reveals every entry once expanded, and collapses back', async () => {
    const wrapper = mountCard(entries(5))

    await wrapper.get('button').trigger('click')

    expect(wrapper.findAll('.space-y-2 > div')).toHaveLength(5)
    expect(wrapper.text()).toContain('Player 4')
    const button = wrapper.get('button')
    expect(button.text()).toContain('common.showLess')
    expect(button.attributes('aria-expanded')).toBe('true')

    await button.trigger('click')
    expect(wrapper.findAll('.space-y-2 > div')).toHaveLength(3)
  })

  it('hides the toggle when nothing is left to reveal', () => {
    const wrapper = mountCard(entries(3))

    expect(wrapper.findAll('.space-y-2 > div')).toHaveLength(3)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('honours a custom collapsed count', () => {
    const wrapper = mountCard(entries(5), { collapsedCount: 1 })

    expect(wrapper.findAll('.space-y-2 > div')).toHaveLength(1)
    expect(wrapper.get('button').text()).toContain('common.showMore:4')
  })

  it('applies the variant colours to the rows', () => {
    const wrapper = mountCard(entries(2), { variant: 'blue' })

    expect(wrapper.get('.space-y-2 > div').classes()).toContain('bg-blue-50')
    expect(wrapper.html()).toContain('text-blue-600')
  })

  it('renders the streak value and its unit label', () => {
    const wrapper = mountCard([entry({ currentStreak: 7 })])

    const row = wrapper.get('.space-y-2 > div')
    expect(row.text()).toContain('Thomas')
    expect(row.text()).toContain('7')
    expect(row.text()).toContain('consecutive wins')
  })
})
