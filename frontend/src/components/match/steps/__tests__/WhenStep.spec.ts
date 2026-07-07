import { describe, it, expect, vi } from 'vitest'
import { mountWithPrime } from '@/test-support/mount'
import WhenStep from '../WhenStep.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

function mountStep(props: Record<string, unknown> = {}) {
  return mountWithPrime(WhenStep, { props })
}

function quickCard(wrapper: ReturnType<typeof mountStep>, label: string) {
  return wrapper.findAll('button.grid *, .grid button').length
    ? wrapper.findAll('.grid button').find((b) => b.text().includes(label))!
    : wrapper.findAll('button').find((b) => b.text().includes(label))!
}

describe('WhenStep', () => {
  it('rend les 4 raccourcis de date', () => {
    const wrapper = mountStep()
    const labels = wrapper.findAll('.grid button').map((b) => b.text())
    expect(labels).toEqual([
      'whenStep.now',
      'whenStep.minus5',
      'whenStep.minus10',
      'whenStep.custom',
    ])
  })

  it('choisir "maintenant" fixe playedAt à maintenant', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T14:00:00'))
    const wrapper = mountStep()
    await quickCard(wrapper, 'whenStep.now').trigger('click')
    const emitted = wrapper.emitted('update:playedAt')
    expect(emitted).toHaveLength(1)
    expect((emitted![0][0] as Date).getTime()).toBe(new Date('2026-07-06T14:00:00').getTime())
    vi.useRealTimers()
  })

  it('choisir "-5 min" recule playedAt de 5 minutes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T14:00:00'))
    const wrapper = mountStep()
    await quickCard(wrapper, 'whenStep.minus5').trigger('click')
    const date = wrapper.emitted('update:playedAt')![0][0] as Date
    expect(date.getTime()).toBe(new Date('2026-07-06T13:55:00').getTime())
    vi.useRealTimers()
  })

  it('choisir "personnalisé" affiche le DatePicker', async () => {
    const wrapper = mountStep()
    expect(wrapper.findComponent({ name: 'DatePicker' }).exists()).toBe(false)
    await quickCard(wrapper, 'whenStep.custom').trigger('click')
    expect(wrapper.findComponent({ name: 'DatePicker' }).exists()).toBe(true)
  })

  it('bouton suivant désactivé sans date, émet next avec une date', async () => {
    const wrapper = mountStep()
    const next = wrapper.find('button.p-button')
    expect(next.attributes('disabled')).toBeDefined()

    await wrapper.setProps({ playedAt: new Date() })
    expect(next.attributes('disabled')).toBeUndefined()
    await next.trigger('click')
    expect(wrapper.emitted('next')).toHaveLength(1)
  })

  it('hideNavigation masque le bouton suivant', () => {
    const wrapper = mountStep({ hideNavigation: true })
    expect(wrapper.find('button.p-button').exists()).toBe(false)
  })
})
