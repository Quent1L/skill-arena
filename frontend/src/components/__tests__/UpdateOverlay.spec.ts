import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import UpdateOverlay from '../UpdateOverlay.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      updateOverlay: {
        continueAnyway: 'Continuer sans attendre',
        doneSubtitle: "L'application vient d'être mise à jour.",
        doneTitle: 'Mise à jour effectuée',
        downloadingSubtitle: 'Téléchargement en cours...',
        fileProgress: '{done} / {total} fichiers',
        forcedSlowHint: 'Cette mise à jour est obligatoire.',
        forcedSubtitle: 'Mise à jour obligatoire...',
        forcedTitle: 'Mise à jour requise',
        slowHint: 'Connexion lente ?',
        subtitle: 'Rechargement en cours...',
        title: 'Nouvelle version disponible',
      },
    },
  },
})

type Props = InstanceType<typeof UpdateOverlay>['$props']

function mountOverlay(props: Partial<Props> = {}) {
  return mount(UpdateOverlay, {
    props: { visible: true, ...props } as Props,
    global: { plugins: [i18n], stubs: { LogoFillGauge: true, BrandBackdrop: true } },
  })
}

describe('UpdateOverlay', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche la progression réelle pendant le téléchargement', async () => {
    const wrapper = mountOverlay({ phase: 'downloading', progress: 0.42 })

    expect(wrapper.text()).toContain('Téléchargement en cours...')
    expect(wrapper.text()).toContain('42%')
    expect(wrapper.find('.update-progress-measured').attributes('style')).toContain('width: 42%')
  })

  it('retombe sur une barre indéterminée tant que le worker n\'a rien rapporté', () => {
    const wrapper = mountOverlay({ phase: 'downloading', progress: null })

    expect(wrapper.find('.update-progress-indeterminate').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('%')
  })

  it('garde la barre chronométrée quand il ne reste que la bascule', () => {
    const wrapper = mountOverlay({ phase: 'applying' })

    expect(wrapper.find('.update-progress-timed').exists()).toBe(true)
    expect(wrapper.text()).toContain('Rechargement en cours...')
  })

  it('escalade avec le temps passé devant l\'écran', async () => {
    vi.useFakeTimers()
    const wrapper = mountOverlay({ phase: 'downloading' })

    expect(wrapper.find('.update-dismiss').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.text()).toContain('Connexion lente ?')
    expect(wrapper.find('.update-dismiss').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(10_000)
    const dismiss = wrapper.find('.update-dismiss')
    expect(dismiss.exists()).toBe(true)

    await dismiss.trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('compte les fichiers précachés pendant le téléchargement', () => {
    const wrapper = mountOverlay({ phase: 'downloading', progress: 0.25, done: 30, total: 120 })

    expect(wrapper.text()).toContain('30 / 120 fichiers')
  })

  it('tait le compteur une fois le téléchargement terminé', () => {
    const wrapper = mountOverlay({ phase: 'applying', done: 120, total: 120 })

    expect(wrapper.text()).not.toContain('fichiers')
  })

  it("n'offre aucune sortie quand la mise à jour est obligatoire", async () => {
    vi.useFakeTimers()
    const wrapper = mountOverlay({ phase: 'downloading', forced: true })

    expect(wrapper.text()).toContain('Mise à jour requise')

    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.text()).toContain('Cette mise à jour est obligatoire.')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.find('.update-dismiss').exists()).toBe(false)
  })

  it('annonce la mise à jour effectuée avec son numéro de version', async () => {
    vi.useFakeTimers()
    const wrapper = mountOverlay({ phase: 'done', version: '1.19.0' })

    expect(wrapper.text()).toContain('Mise à jour effectuée')
    expect(wrapper.text()).toContain("L'application vient d'être mise à jour.")
    expect(wrapper.find('.update-version').text()).toBe('1.19.0')
    expect(wrapper.find('.update-progress-track').exists()).toBe(false)

    // Rien n'est en attente : ni excuse de lenteur, ni échappatoire.
    await vi.advanceTimersByTimeAsync(20_000)
    expect(wrapper.find('.update-hint').exists()).toBe(false)
    expect(wrapper.find('.update-dismiss').exists()).toBe(false)
  })

  it('repart de zéro quand il est masqué puis réaffiché', async () => {
    vi.useFakeTimers()
    const wrapper = mountOverlay({ phase: 'downloading' })

    await vi.advanceTimersByTimeAsync(15_000)
    expect(wrapper.find('.update-dismiss').exists()).toBe(true)

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    expect(wrapper.find('.update-dismiss').exists()).toBe(false)
  })
})
