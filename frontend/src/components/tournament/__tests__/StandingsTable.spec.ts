import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, RouterLinkStub } from '@vue/test-utils'
import type { StandingsEntry } from '@skol-arena/shared'
import { mountWithPrime } from '@/test-support/mount'
import { makeStandingRow } from '@/test-support/factories'
import { useStandingsService } from '@/composables/standings.service'
import StandingsTable from '../StandingsTable.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
}))
vi.mock('@/composables/standings.service')
vi.mock('@/composables/outcome-type.api')
vi.mock('@/composables/useViewport.ts', () => ({
  useViewport: () => ({ isMobile: ref(false) }),
}))

const standings = ref<StandingsEntry[]>([])
const loadOfficialStandings = vi.fn()
const loadProvisionalStandings = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  standings.value = [
    makeStandingRow({ id: 'p1', name: 'Alice', shortName: 'AL', points: 9, wins: 3 }),
    makeStandingRow({ id: 'p2', name: 'Bob', shortName: 'BO', points: 3, wins: 1 }),
  ]
  vi.mocked(useStandingsService).mockReturnValue({
    standings,
    loading: ref(false),
    error: ref(null),
    loadOfficialStandings,
    loadProvisionalStandings,
  } as unknown as ReturnType<typeof useStandingsService>)
})

async function mountTable(props: Record<string, unknown> = {}) {
  // showProvisionalToggle is an optional Boolean prop: absent, Vue casts it to false
  const wrapper = mountWithPrime(StandingsTable, {
    props: { tournamentId: 't1', showProvisionalToggle: true, ...props },
    global: { directives: { tooltip: {} } },
  })
  await flushPromises()
  return wrapper
}

describe('StandingsTable', () => {
  it('charge le classement officiel au mount et rend une ligne par entrée', async () => {
    const wrapper = await mountTable()
    expect(loadOfficialStandings).toHaveBeenCalledWith('t1')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('mode flex: noms cliquables vers le profil joueur', async () => {
    const wrapper = await mountTable({ teamMode: 'flex' })
    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].props('to')).toEqual({
      path: '/players/p1',
      query: { tournamentId: 't1' },
    })
  })

  it('mode static: pas de lien joueur', async () => {
    const wrapper = await mountTable({ teamMode: 'static' })
    expect(wrapper.findAllComponents(RouterLinkStub)).toHaveLength(0)
  })

  it('bascule provisoire: émet update:standingsType et charge le provisoire', async () => {
    const wrapper = await mountTable()
    wrapper.findComponent({ name: 'SelectButton' }).vm.$emit('update:modelValue', 'provisional')
    await flushPromises()
    expect(wrapper.emitted('update:standingsType')).toEqual([['provisional']])
    expect(loadProvisionalStandings).toHaveBeenCalledWith('t1')
  })

  it('showProvisionalToggle=false masque la bascule', async () => {
    const wrapper = await mountTable({ showProvisionalToggle: false })
    expect(wrapper.findComponent({ name: 'SelectButton' }).exists()).toBe(false)
  })

  it('classement vide: message dédié', async () => {
    standings.value = []
    const wrapper = await mountTable()
    expect(wrapper.text()).toContain('standingsTable.noStandings')
  })

  it('colonne nuls seulement si allowDraw', async () => {
    const withDraw = await mountTable({ allowDraw: true })
    expect(withDraw.text()).toContain('standingsTable.columnDraws')

    const noDraw = await mountTable({ allowDraw: false })
    expect(noDraw.text()).not.toContain('standingsTable.columnDraws')
  })
})
