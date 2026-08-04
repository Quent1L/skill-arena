import { describe, it, expect, vi } from 'vitest'
import { RouterLinkStub } from '@vue/test-utils'
import { mountWithPrime } from '@/test-support/mount'
import { makeTier, makePlayerMmr } from '@/test-support/factories'
import RankedLeaderboard from '../RankedLeaderboard.vue'
import InfoTooltip from '@/components/InfoTooltip.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
}))

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

type ModeItem = { label: string; icon: string; command: () => void }

// The view switcher is a popup menu: its model is readable without opening it.
function modeItems(wrapper: ReturnType<typeof mountBoard>): ModeItem[] {
  const menu = wrapper.findComponent({ name: 'Menu' })
  return menu.exists() ? (menu.props('model') as ModeItem[]) : []
}

async function selectMode(wrapper: ReturnType<typeof mountBoard>, mode: string) {
  modeItems(wrapper).find((item) => item.label === `rankedLeaderboard.mode${mode}`)!.command()
  await wrapper.vm.$nextTick()
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

  it('la vue active est écrite sur le déclencheur et cochée dans le menu', async () => {
    const wrapper = mountBoard()
    const trigger = wrapper.find('[data-test="leaderboard-mode-trigger"]')
    expect(wrapper.text()).toContain('rankedLeaderboard.modeLabel')
    expect(trigger.attributes('aria-label')).toContain('rankedLeaderboard.modeOfficial')
    expect(trigger.text()).toContain('rankedLeaderboard.modeOfficial')

    await selectMode(wrapper, 'Provisional')

    expect(trigger.text()).toContain('rankedLeaderboard.modeProvisional')
    const checked = modeItems(wrapper).filter((item) => item.icon.includes('fa-check'))
    expect(checked.map((item) => item.label)).toEqual(['rankedLeaderboard.modeProvisional'])
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

  it("l'infobulle ne décrit que les vues réellement proposées", () => {
    const ongoing = mountBoard().findComponent(InfoTooltip).props('text')
    expect(ongoing).toContain('rankedLeaderboard.hintOfficial')
    expect(ongoing).toContain('rankedLeaderboard.hintProvisional')
    expect(ongoing).not.toContain('rankedLeaderboard.hintPeak')

    const finished = mountBoard({ showSeasonStats: true }).findComponent(InfoTooltip).props('text')
    expect(finished).toContain('rankedLeaderboard.hintPeak')
    expect(finished).not.toContain('rankedLeaderboard.hintProvisional')
  })

  it('masquage de la bascule via showModeToggle', () => {
    const wrapper = mountBoard({ showModeToggle: false })
    expect(wrapper.find('[data-test="leaderboard-mode-trigger"]').exists()).toBe(false)
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
      expect(modeItems(mountBoard())).toHaveLength(2)
    })

    // Rien ne reste à valider une fois la saison close: le provisoire ne ferait que
    // répéter l'officiel.
    it('saison terminée: officiel, peak et moyenne, sans provisoire', () => {
      expect(modeItems(mountFinished()).map((item) => item.label)).toEqual([
        'rankedLeaderboard.modeOfficial',
        'rankedLeaderboard.modePeak',
        'rankedLeaderboard.modeAverage',
      ])
    })

    it('bascule visible même quand le provisoire est désactivé côté tournoi', () => {
      const wrapper = mountFinished({ showModeToggle: false })
      expect(wrapper.find('[data-test="leaderboard-mode-trigger"]').exists()).toBe(true)
      expect(modeItems(wrapper)).toHaveLength(3)
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
