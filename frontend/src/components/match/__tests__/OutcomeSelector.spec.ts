import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { OutcomeType, OutcomeReason } from '@skol-arena/shared/types/index'
import { mountWithPrime } from '@/test-support/mount'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import { outcomeReasonApi } from '@/composables/outcome-reason.api'
import OutcomeSelector from '../OutcomeSelector.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
}))
vi.mock('@/composables/outcome-type.api')
vi.mock('@/composables/outcome-reason.api')
vi.mock('@/composables/tournament/tournament.api')

const normalType = { id: 'ot-normal', name: 'Normal', disciplineId: 'd1' } as OutcomeType
const forfeitType = { id: 'ot-forfeit', name: 'Forfeit', disciplineId: 'd1' } as OutcomeType
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

  it('auto-selects the Normal type when nothing is chosen', async () => {
    const wrapper = await mountSelector()
    expect(wrapper.emitted('update:outcomeTypeId')?.[0]).toEqual(['ot-normal'])
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
