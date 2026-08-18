import { describe, it, expect, vi } from 'vitest'
import { mountWithPrime } from '@/test-support/mount'
import ScoreInput from '../ScoreInput.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

function mountScoreInput(props: Record<string, unknown> = {}) {
  return mountWithPrime(ScoreInput, {
    props: { tournamentId: 't1', ...props },
  })
}

describe('ScoreInput', () => {
  it('reported mode (default): two score fields, no date', () => {
    const wrapper = mountScoreInput()
    expect(wrapper.findAllComponents({ name: 'InputNumber' })).toHaveLength(2)
    expect(wrapper.find('#scheduled-date-inline').exists()).toBe(false)
    expect(wrapper.text()).toContain('scoreInput.scoreA')
    expect(wrapper.text()).toContain('scoreInput.scoreB')
  })

  it('scheduled mode: DatePicker with a label, no scores', () => {
    const wrapper = mountScoreInput({ modeSelection: 'scheduled' })
    expect(wrapper.findComponent({ name: 'DatePicker' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('scoreInput.matchDateTime')
    expect(wrapper.findAllComponents({ name: 'InputNumber' })).toHaveLength(0)
  })

  it('emits update:scoreA and update:scoreB', () => {
    const wrapper = mountScoreInput()
    const [scoreA, scoreB] = wrapper.findAllComponents({ name: 'InputNumber' })
    scoreA.vm.$emit('update:modelValue', 3)
    scoreB.vm.$emit('update:modelValue', 1)
    expect(wrapper.emitted('update:scoreA')).toEqual([[3]])
    expect(wrapper.emitted('update:scoreB')).toEqual([[1]])
  })

  it('emits update:modeSelection via the SelectButton', () => {
    const wrapper = mountScoreInput()
    wrapper.findComponent({ name: 'SelectButton' }).vm.$emit('update:modelValue', 'scheduled')
    expect(wrapper.emitted('update:modeSelection')).toEqual([['scheduled']])
  })

  it('emits update:scheduledDate in scheduled mode', () => {
    const wrapper = mountScoreInput({ modeSelection: 'scheduled' })
    const date = new Date('2026-07-10T18:00:00')
    wrapper.findComponent({ name: 'DatePicker' }).vm.$emit('update:modelValue', date)
    expect(wrapper.emitted('update:scheduledDate')).toEqual([[date]])
  })
})
