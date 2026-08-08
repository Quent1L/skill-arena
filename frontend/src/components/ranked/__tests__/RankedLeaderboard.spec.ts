import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RouterLinkStub } from '@vue/test-utils'
import { mountWithPrime } from '@/test-support/mount'
import { makeTier, makePlayerMmr } from '@/test-support/factories'
import RankedLeaderboard from '../RankedLeaderboard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
}))

// jsdom reports a 0x0 screen, which `useViewport` reads as mobile: the form factor is
// pinned here instead, so each test states which switcher it exercises.
const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('@/composables/useViewport', async () => {
  const { ref } = await import('vue')
  return { useViewport: () => ({ isMobile: ref(viewport.mobile), width: ref(1024) }) }
})

const tiers = [
  makeTier({ id: 'bronze', level: 1, name: 'Bronze', minMmr: 700 }),
  makeTier({ id: 'gold', level: 2, name: 'Gold', minMmr: 1100 }),
]

const players = [
  makePlayerMmr({
    currentMmr: 1450,
    player: { id: 'u1', displayName: 'Alice', shortName: 'AL' },
  }),
  makePlayerMmr({
    currentMmr: 1000,
    player: { id: 'u2', displayName: 'Bob', shortName: 'BO' },
  }),
]

// Unless a test says otherwise the switcher under test is the desktop sidebar.
function modeLabels(wrapper: ReturnType<typeof mountBoard>): string[] {
  return wrapper.findAll('[data-test^="subtab-"]').map((button) => button.text())
}

async function selectMode(wrapper: ReturnType<typeof mountBoard>, mode: string) {
  await wrapper.find(`[data-test="subtab-${mode.toLowerCase()}"]`).trigger('click')
}

function mountBoard(props: Record<string, unknown> = {}) {
  // showModeToggle is an optional Boolean prop: absent, Vue casts it to false
  return mountWithPrime(RankedLeaderboard, {
    props: { players, tiers, showModeToggle: true, ...props },
  })
}

describe('RankedLeaderboard', () => {
  it('sans tiers: message dédié', () => {
    const wrapper = mountBoard({ tiers: [] })
    expect(wrapper.text()).toContain('rankedLeaderboard.noTiers')
  })

  it('groupe les joueurs sous le bon tier, tiers du plus haut au plus bas', () => {
    const wrapper = mountBoard()
    const text = wrapper.text()
    // Gold en premier (tri desc), Alice (1450) dedans; Bob (1000) en Bronze
    expect(text.indexOf('Gold')).toBeLessThan(text.indexOf('Bronze'))
    expect(text.indexOf('Gold')).toBeLessThan(text.indexOf('Alice'))
    expect(text.indexOf('Bronze')).toBeLessThan(text.indexOf('Bob'))
    expect(text.indexOf('Alice')).toBeLessThan(text.indexOf('Bronze'))
  })

  it('bascule provisoire: émet load-provisional une seule fois', async () => {
    const wrapper = mountBoard()
    await selectMode(wrapper, 'Provisional')
    await selectMode(wrapper, 'Official')
    await selectMode(wrapper, 'Provisional')
    expect(wrapper.emitted('load-provisional')).toHaveLength(1)
  })

  it('la vue active est la seule marquée sélectionnée dans la navigation', async () => {
    const wrapper = mountBoard()
    const selected = () =>
      wrapper
        .findAll('[data-test^="subtab-"]')
        .filter((button) => button.attributes('aria-selected') === 'true')
        .map((button) => button.text())

    expect(selected()).toEqual(['rankedLeaderboard.modeOfficial'])

    await selectMode(wrapper, 'Provisional')

    expect(selected()).toEqual(['rankedLeaderboard.modeProvisional'])
  })

  it('premier chargement: spinner plein écran', () => {
    const wrapper = mountBoard({ players: [], loading: true })
    expect(wrapper.findComponent({ name: 'ProgressSpinner' }).exists()).toBe(true)
  })

  it('rafraîchissement avec données: bannière discrète, liste conservée', () => {
    const wrapper = mountBoard({ loading: true })
    expect(wrapper.findComponent({ name: 'ProgressSpinner' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('rankedLeaderboard.refreshing')
    expect(wrapper.text()).toContain('Alice')
  })

  it('recalcul en cours: bannière dédiée', () => {
    const wrapper = mountBoard({ isRecalculating: true })
    expect(wrapper.text()).toContain('rankedLeaderboard.recalculating')
  })

  it('ligne du joueur courant mise en évidence', () => {
    const wrapper = mountBoard({ currentUserId: 'u1' })
    const rows = wrapper.findAllComponents(RouterLinkStub)
    const aliceRow = rows.find((r) => r.text().includes('Alice'))
    expect(aliceRow!.classes()).toContain('bg-primary-900/30')
    expect(aliceRow!.text()).toContain('rankedLeaderboard.you')
  })

  // Une seule vue: pas de navigation du tout, juste le classement.
  it('masquage de la bascule via showModeToggle', () => {
    const wrapper = mountBoard({ showModeToggle: false })
    expect(modeLabels(wrapper)).toEqual([])
    expect(wrapper.text()).toContain('Alice')
  })

  // Peak et moyenne n'ont de sens qu'une fois la saison terminée.
  describe('classements de saison', () => {
    const seasonMmrPlayers = [
      makePlayerMmr({
        currentMmr: 1000,
        player: { id: 'u1', displayName: 'Alice', shortName: 'AL' },
      }),
      makePlayerMmr({
        currentMmr: 1450,
        player: { id: 'u2', displayName: 'Bob', shortName: 'BO' },
      }),
    ].map((p, i) =>
      i === 0 ? { ...p, peakMmr: 1450, avgMmr: 1200 } : { ...p, peakMmr: 1150, avgMmr: 1300 },
    )

    function mountFinished(props: Record<string, unknown> = {}) {
      return mountBoard({ showSeasonStats: true, seasonMmrPlayers, ...props })
    }

    it('saison en cours: pas de modes peak/moyenne', () => {
      expect(modeLabels(mountBoard())).toEqual([
        'rankedLeaderboard.modeOfficial',
        'rankedLeaderboard.modeProvisional',
      ])
    })

    // Rien ne reste à valider une fois la saison close: le provisoire ne ferait que
    // répéter l'officiel.
    it('saison terminée: officiel, peak et moyenne, sans provisoire', () => {
      expect(modeLabels(mountFinished())).toEqual([
        'rankedLeaderboard.modeOfficial',
        'rankedLeaderboard.modePeak',
        'rankedLeaderboard.modeAverage',
      ])
    })

    it('bascule visible même quand le provisoire est désactivé côté tournoi', () => {
      expect(modeLabels(mountFinished({ showModeToggle: false }))).toHaveLength(3)
    })

    it('émet load-season-stats une seule fois pour les deux vues', async () => {
      const wrapper = mountFinished()
      await selectMode(wrapper, 'Peak')
      await selectMode(wrapper, 'Average')
      await selectMode(wrapper, 'Peak')
      expect(wrapper.emitted('load-season-stats')).toHaveLength(1)
    })

    it('mode peak: groupement et tri sur le peak, pas sur le MMR courant', async () => {
      const wrapper = mountFinished()
      await selectMode(wrapper, 'Peak')
      const text = wrapper.text()
      // Alice (peak 1450) passe en Gold devant Bob (peak 1150, Gold aussi mais plus bas)
      expect(text.indexOf('Alice')).toBeLessThan(text.indexOf('Bob'))
      expect(text).toContain('1450')
      expect(text).not.toContain('1000')
    })

    it('mode moyenne: classe sur avgMmr', async () => {
      const wrapper = mountFinished()
      await selectMode(wrapper, 'Average')
      const text = wrapper.text()
      // Bob (1300) devant Alice (1200)
      expect(text.indexOf('Bob')).toBeLessThan(text.indexOf('Alice'))
      expect(text).toContain('1300')
    })

    it('mode saison: streak courant masqué', async () => {
      const onStreak = { ...seasonMmrPlayers[0], winStreak: 4 }
      const wrapper = mountFinished({ players: [onStreak], seasonMmrPlayers: [onStreak] })
      expect(wrapper.text()).toContain('🔥')
      await selectMode(wrapper, 'Peak')
      expect(wrapper.text()).not.toContain('🔥')
    })
  })

  // Un joueur en placement n'a pas de MMR arrêté: il est listé à part, sans rang ni
  // MMR, et ne compte pas dans le classement des autres.
  describe('joueurs en placement', () => {
    const inPlacement = makePlayerMmr({
      currentMmr: 1450,
      matchesPlayed: 2,
      recentResults: [],
      player: { id: 'u3', displayName: 'Charlie', shortName: 'CH' },
    })

    function mountWithPlacement(props: Record<string, unknown> = {}) {
      return mountBoard({ players: [...players, inPlacement], placementMatches: 5, ...props })
    }

    it('les sort des tiers et les liste dans une section dédiée, en bas', () => {
      const wrapper = mountWithPlacement()
      const text = wrapper.text()
      expect(text).toContain('rankedLeaderboard.placementSection')
      expect(text.indexOf('Gold')).toBeLessThan(text.indexOf('rankedLeaderboard.placementSection'))
      expect(text.indexOf('rankedLeaderboard.placementSection')).toBeLessThan(
        text.indexOf('Charlie'),
      )
    })

    it("n'affiche jamais leur MMR, seulement leur progression", () => {
      const wrapper = mountWithPlacement()
      const row = wrapper
        .findAllComponents(RouterLinkStub)
        .find((r) => r.text().includes('Charlie'))!
      expect(row.text()).not.toContain('1450')
      expect(row.text()).toContain('rankedLeaderboard.placementProgress')
    })

    it('ne décale pas les rangs des joueurs classés', () => {
      const wrapper = mountWithPlacement()
      const rankOf = (name: string) =>
        wrapper
          .findAllComponents(RouterLinkStub)
          .find((r) => r.text().includes(name))!
          .find('.w-5')
          .text()
      // Charlie serait 1er sur son MMR: il ne prend la place de personne.
      expect(rankOf('Alice')).toBe('1')
      expect(rankOf('Bob')).toBe('2')
    })

    it('sans matchs de placement configurés, tout le monde est classé', () => {
      const wrapper = mountWithPlacement({ placementMatches: 0 })
      expect(wrapper.text()).not.toContain('rankedLeaderboard.placementSection')
      expect(wrapper.text()).toContain('1450')
    })

    it('la section disparaît quand plus personne n’est en placement', () => {
      const wrapper = mountBoard({ players, placementMatches: 5 })
      expect(wrapper.text()).not.toContain('rankedLeaderboard.placementSection')
    })
  })

  // Sur mobile les vues sont des volets voisins dans une piste draggable, pas un
  // rendu unique: elles sont montées ensemble pour que le doigt puisse les faire glisser.
  describe('mobile', () => {
    beforeEach(() => {
      viewport.mobile = true
    })
    afterEach(() => {
      viewport.mobile = false
    })

    it('monte les vues voisines et bascule au tap', async () => {
      const wrapper = mountBoard({ provisionalPlayers: [] })
      expect(modeLabels(wrapper)).toEqual([
        'rankedLeaderboard.modeOfficial',
        'rankedLeaderboard.modeProvisional',
      ])

      // La vue provisoire est déjà montée, donc ses données sont demandées d'emblée.
      expect(wrapper.emitted('load-provisional')).toHaveLength(1)

      await selectMode(wrapper, 'Provisional')
      const selected = wrapper
        .findAll('[data-test^="subtab-"]')
        .filter((button) => button.attributes('aria-selected') === 'true')
      expect(selected.map((button) => button.text())).toEqual([
        'rankedLeaderboard.modeProvisional',
      ])
    })
  })

  // Le rang suivant est cherché par ordre, pas en `level + 1`: une saison éditée
  // avant que les niveaux soient recompactés peut avoir des trous.
  describe('niveaux non contigus (1, 2, 4)', () => {
    const gapped = [
      makeTier({ id: 'bronze', level: 1, name: 'Bronze', minMmr: 700 }),
      makeTier({ id: 'silver', level: 2, name: 'Silver', minMmr: 900 }),
      makeTier({ id: 'gold', level: 4, name: 'Gold', minMmr: 1100 }),
    ]

    it('barre de progression partielle et non pleine pour un joueur de milieu de rang', () => {
      const wrapper = mountBoard({
        tiers: gapped,
        players: [
          makePlayerMmr({
            currentMmr: 1000,
            player: { id: 'u2', displayName: 'Bob', shortName: 'BO' },
          }),
        ],
      })
      // Silver 900 → Gold 1100, Bob à 1000 = moitié de la plage
      const bar = wrapper.find('[style*="width: 50%"]')
      expect(bar.exists()).toBe(true)
      expect(wrapper.find('[style*="width: 100%"]').exists()).toBe(false)
    })

    it('seuil du rang le plus bas exprimé par rapport au rang suivant', () => {
      const wrapper = mountBoard({ tiers: gapped })
      expect(wrapper.text()).toContain('< 900 MMR')
    })
  })
})
