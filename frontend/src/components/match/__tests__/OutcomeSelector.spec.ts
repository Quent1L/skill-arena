import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { OutcomeType, OutcomeReason } from '@skol-arena/shared/types/index'
import { mountWithPrime } from '@/test-support/mount'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import { outcomeReasonApi } from '@/composables/outcome-reason.api'
import { tournamentApi } from '@/composables/tournament/tournament.api'
import OutcomeSelector from '../OutcomeSelector.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
}))
vi.mock('@/composables/outcome-type.api')
vi.mock('@/composables/outcome-reason.api')
vi.mock('@/composables/tournament/tournament.api')

// `isDefault` is what marks the outcome needing neither a reason nor an explicit
// winner. It used to be inferred from the literal name "Normal", which broke as
// soon as an admin renamed the type.
const normalType = {
  id: 'ot-normal',
  name: 'Normal',
  disciplineId: 'd1',
  isDefault: true,
} as OutcomeType
const forfeitType = {
  id: 'ot-forfeit',
  name: 'Forfeit',
  disciplineId: 'd1',
  isDefault: false,
} as OutcomeType
const forfeitReason = {
  id: 'or-1',
  name: 'No-show',
  outcomeTypeId: 'ot-forfeit',
} as OutcomeReason

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(outcomeTypeApi.list).mockResolvedValue([normalType, forfeitType])
  vi.mocked(outcomeReasonApi.list).mockResolvedValue([forfeitReason])
})

async function mountSelector(props: Record<string, unknown> = {}) {
  const wrapper = mountWithPrime(OutcomeSelector, {
    props: { disciplineId: 'd1', ...props },
  })
  await flushPromises()
  return wrapper
}

describe('OutcomeSelector', () => {
  it('loads types on mount for the discipline', async () => {
    await mountSelector()
    expect(outcomeTypeApi.list).toHaveBeenCalledWith('d1')
  })

  it('auto-selects the default type when nothing is chosen', async () => {
    const wrapper = await mountSelector()
    expect(wrapper.emitted('update:outcomeTypeId')?.[0]).toEqual(['ot-normal'])
  })

  it('still finds the default type after it has been renamed', async () => {
    vi.mocked(outcomeTypeApi.list).mockResolvedValue([
      { ...normalType, name: 'Partie classique' } as OutcomeType,
      forfeitType,
    ])

    const wrapper = await mountSelector()

    expect(wrapper.emitted('update:outcomeTypeId')?.[0]).toEqual(['ot-normal'])
  })

  describe('inside a competition', () => {
    const ruleset = {
      payload: {
        discipline: { id: 'd1', name: 'D', teamInteractionMode: 'COLLABORATIVE' },
        outcomeTypes: [
          {
            id: 'ot-normal',
            name: 'Normal',
            points: 3,
            mmrMultiplier: 1,
            scoreCountsForMmr: true,
            isDefault: true,
            archivedAt: null,
            reasons: [],
          },
          {
            id: 'ot-forfeit',
            name: 'Forfeit',
            points: 1,
            mmrMultiplier: 1,
            scoreCountsForMmr: true,
            isDefault: false,
            archivedAt: null,
            reasons: [{ id: 'or-1', name: 'No-show' }],
          },
          {
            id: 'ot-retired',
            name: 'Retiré',
            points: 1,
            mmrMultiplier: 1,
            scoreCountsForMmr: true,
            isDefault: false,
            archivedAt: '2026-01-01T00:00:00.000Z',
            reasons: [],
          },
        ],
      },
      version: 1,
      appliedAt: '2026-01-01T00:00:00.000Z',
      recalcPendingAt: null,
    }

    beforeEach(() => {
      vi.mocked(tournamentApi.getRuleset).mockResolvedValue(ruleset as never)
    })

    it('reads the competition ruleset rather than the live discipline', async () => {
      await mountSelector({ tournamentId: 't1', disciplineId: undefined })

      expect(tournamentApi.getRuleset).toHaveBeenCalledWith('t1')
      expect(outcomeTypeApi.list).not.toHaveBeenCalled()
    })

    it('does not offer an archived outcome type', async () => {
      const wrapper = await mountSelector({ tournamentId: 't1', disciplineId: undefined })

      const typeSelect = wrapper
        .findAllComponents({ name: 'Select' })
        .find((c) => c.attributes('id') === 'outcome-type')
      const offered = (typeSelect!.props('options') as OutcomeType[]).map((o) => o.id)

      expect(offered).toEqual(['ot-normal', 'ot-forfeit'])
    })

    it('takes reasons from the payload instead of a request per type', async () => {
      const wrapper = await mountSelector({
        tournamentId: 't1',
        disciplineId: undefined,
        outcomeTypeId: 'ot-forfeit',
      })

      expect(outcomeReasonApi.list).not.toHaveBeenCalled()
      expect(wrapper.find('#outcome-reason').exists()).toBe(true)
    })
  })

  it('Normal type: neither reason nor winner shown', async () => {
    const wrapper = await mountSelector({ outcomeTypeId: 'ot-normal' })
    expect(wrapper.find('#outcome-reason').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('outcomeSelector.winnerLabel')
  })

  it('non-Normal type with reasons: reason Select + winner shown', async () => {
    const wrapper = await mountSelector({ outcomeTypeId: 'ot-forfeit' })
    expect(outcomeReasonApi.list).toHaveBeenCalledWith('ot-forfeit')
    expect(wrapper.find('#outcome-reason').exists()).toBe(true)
    expect(wrapper.text()).toContain('outcomeSelector.winnerLabel')
  })

  it('winner hidden when the scores already settle it (scoreA ≠ scoreB)', async () => {
    const equal = await mountSelector({ outcomeTypeId: 'ot-forfeit', scoreA: 1, scoreB: 1 })
    expect(equal.text()).not.toContain('outcomeSelector.winnerLabel')

    const different = await mountSelector({ outcomeTypeId: 'ot-forfeit', scoreA: 2, scoreB: 1 })
    expect(different.text()).toContain('outcomeSelector.winnerLabel')
  })

  it('draw option only if allowDraw', async () => {
    const noDraw = await mountSelector({ outcomeTypeId: 'ot-forfeit' })
    expect(noDraw.text()).not.toContain('outcomeSelector.draw')

    const withDraw = await mountSelector({ outcomeTypeId: 'ot-forfeit', allowDraw: true })
    expect(withDraw.text()).toContain('outcomeSelector.draw')
  })

  it('emits update:outcomeReasonId when a reason is selected', async () => {
    const wrapper = await mountSelector({ outcomeTypeId: 'ot-forfeit' })
    const reasonSelect = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('id') === 'outcome-reason')
    reasonSelect!.vm.$emit('update:modelValue', 'or-1')
    expect(wrapper.emitted('update:outcomeReasonId')).toEqual([['or-1']])
  })

  it('emits update:winner via the SelectButton', async () => {
    const wrapper = await mountSelector({ outcomeTypeId: 'ot-forfeit' })
    wrapper.findComponent({ name: 'SelectButton' }).vm.$emit('update:modelValue', 'teamB')
    expect(wrapper.emitted('update:winner')).toEqual([['teamB']])
  })
})
