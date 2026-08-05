import { describe, it, expect } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { subTabWindow, useSubTabs, type SubTabOption } from '../useSubTabs'

type Value = 'profile' | 'global'

const BOTH: SubTabOption<Value>[] = [
  { value: 'profile', label: 'Profil' },
  { value: 'global', label: 'Global' },
]

async function mountSubTabs(url = '/tournaments/1', options: Ref<SubTabOption<Value>[]> = ref(BOTH)) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()

  let api!: ReturnType<typeof useSubTabs<Value>>
  const Host = defineComponent({
    setup() {
      api = useSubTabs<Value>({ options, queryKey: 'statsSub' })
      return () => h('div')
    },
  })
  mount(Host, { global: { plugins: [router] } })

  return { api, router: router as Router, options }
}

describe('useSubTabs', () => {
  it('démarre sur la première option', async () => {
    const { api } = await mountSubTabs()
    expect(api.active.value).toBe('profile')
    expect(api.activeIndex.value).toBe(0)
  })

  it("restaure la valeur portée par l'URL", async () => {
    const { api } = await mountSubTabs('/tournaments/1?statsSub=global')
    expect(api.active.value).toBe('global')
  })

  // Les vues offertes dépendent des props: l'URL peut nommer une vue absente ici.
  it('ignore une valeur qui ne fait pas partie des options', async () => {
    const { api } = await mountSubTabs('/tournaments/1?statsSub=peak')
    expect(api.active.value).toBe('profile')
  })

  it("écrit la vue dans l'URL, et retire le paramètre pour la vue par défaut", async () => {
    const { api, router } = await mountSubTabs('/tournaments/1?tab=stats')

    api.setActive('global')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ tab: 'stats', statsSub: 'global' })

    api.setActive('profile')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ tab: 'stats' })
  })

  // Une saison qui se termine perd sa vue provisoire: l'active ne doit pas lui survivre.
  it('retombe sur le défaut quand la vue active disparaît des options', async () => {
    const options = ref(BOTH)
    const { api } = await mountSubTabs('/tournaments/1?statsSub=global', options)
    expect(api.active.value).toBe('global')

    options.value = [BOTH[0]!]
    await nextTick()
    expect(api.active.value).toBe('profile')
  })

  it('sans routeur, la vue reste locale', () => {
    let api!: ReturnType<typeof useSubTabs<Value>>
    const Host = defineComponent({
      setup() {
        api = useSubTabs<Value>({ options: ref(BOTH), queryKey: 'statsSub' })
        return () => h('div')
      },
    })
    mount(Host)

    api.setActive('global')
    expect(api.active.value).toBe('global')
  })
})

describe('subTabWindow', () => {
  it('couvre les voisins immédiats, sans déborder', () => {
    expect(subTabWindow(0, 4, 1)).toEqual([0, 1])
    expect(subTabWindow(2, 4, 1)).toEqual([1, 2, 3])
    expect(subTabWindow(3, 4, 1)).toEqual([2, 3])
  })

  it('un rayon nul ne monte que la vue active', () => {
    expect(subTabWindow(1, 3, 0)).toEqual([1])
  })
})
