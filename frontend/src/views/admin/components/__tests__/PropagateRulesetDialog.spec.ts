import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import type { ImpactedCompetition } from '@skol-arena/shared/types/index'
import { mountWithPrime } from '@/test-support/mount'
import PropagateRulesetDialog from '../PropagateRulesetDialog.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
}))

const drifting: ImpactedCompetition = {
  id: 't-drift',
  name: 'Championnat en cours',
  mode: 'championship',
  status: 'ongoing',
  matchCount: 4,
  hasDrift: true,
}

const upToDate: ImpactedCompetition = {
  id: 't-ok',
  name: 'Saison alignée',
  mode: 'ranked',
  status: 'ongoing',
  matchCount: 0,
  hasDrift: false,
}

async function mountDialog(rows: ImpactedCompetition[]) {
  const wrapper = mountWithPrime(PropagateRulesetDialog, {
    props: { visible: true, disciplineId: 'd-1' },
    global: { stubs: { teleport: true } },
  })
  await flushPromises()
  wrapper.vm.setCompetitions(rows)
  await flushPromises()
  return wrapper
}

describe('PropagateRulesetDialog', () => {
  it('renders a real selection column so competitions can be picked', async () => {
    // Regression: the column was declared with a `selection-style` prop that does
    // not exist, so it rendered empty and nothing could be selected at all.
    const wrapper = await mountDialog([drifting, upToDate])

    const selectionColumn = wrapper
      .findAllComponents(Column)
      .find((column) => column.props('selectionMode') === 'multiple')

    expect(selectionColumn).toBeDefined()
    expect(wrapper.findComponent(DataTable).props('selection')).toBeDefined()
  })

  it('preselects what has drifted and leaves the rest alone', async () => {
    const wrapper = await mountDialog([drifting, upToDate])

    const selection = wrapper.findComponent(DataTable).props('selection') as ImpactedCompetition[]

    expect(selection.map((row) => row.id)).toEqual(['t-drift'])
  })

  it('emits only the selected competitions', async () => {
    const wrapper = await mountDialog([drifting, upToDate])

    wrapper.vm.$emit('propagate', ['t-drift'])
    await flushPromises()

    expect(wrapper.emitted('propagate')?.[0]).toEqual([['t-drift']])
  })

  it('asks its parent to load when it becomes visible', async () => {
    const wrapper = mountWithPrime(PropagateRulesetDialog, {
      props: { visible: false, disciplineId: 'd-1' },
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    await wrapper.setProps({ visible: true })
    await flushPromises()

    expect(wrapper.emitted('load')?.[0]).toEqual(['d-1'])
  })
})
