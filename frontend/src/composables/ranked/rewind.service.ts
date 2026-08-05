import { ref } from 'vue'
import { i18n } from '@/i18n'
import { rewindApi } from './rewind.api'
import type {
  RewindArchiveEntry,
  RewindBundle,
  RewindPromotion,
  SeasonRewindPayload,
} from '@skol-arena/shared/types/index'

export type RewindCardKey =
  | 'intro'
  | 'finalRank'
  | 'totals'
  | 'journey'
  | 'bestRank'
  | 'peak'
  | 'streaks'
  | 'feats'
  | 'badges'
  | 'percentiles'
  | 'awardsPerformance'
  | 'awardsCombat'
  | 'awardsEndurance'
  | 'awardsCooperation'
  | 'conclusion'
  | 'share'

/** Canonical deck order. Cards without data are dropped, never rendered empty. */
const CARD_ORDER: RewindCardKey[] = [
  'intro',
  'finalRank',
  'totals',
  'journey',
  'bestRank',
  'peak',
  'streaks',
  'feats',
  'badges',
  'percentiles',
  'awardsPerformance',
  'awardsCombat',
  'awardsEndurance',
  'awardsCooperation',
  'conclusion',
  'share',
]

/** Cards that only make sense for the player the deck belongs to. */
const PLAYER_CARDS = new Set<RewindCardKey>([
  'finalRank',
  'totals',
  'journey',
  'bestRank',
  'peak',
  'streaks',
  'feats',
  'badges',
  'percentiles',
  'share',
])

function hasAward(group: Record<string, unknown>): boolean {
  return Object.values(group).some((award) => award !== null && award !== undefined)
}

function groupOf(season: SeasonRewindPayload, key: RewindCardKey): Record<string, unknown> | null {
  if (key === 'awardsPerformance') return season.performance
  if (key === 'awardsCombat') return season.combat
  if (key === 'awardsEndurance') return season.endurance
  if (key === 'awardsCooperation') return season.cooperation
  return null
}

/**
 * Decides which cards the deck actually shows. A season nobody could win an
 * award in, a player with no badges or no upset to brag about: those cards are
 * removed rather than displayed with a dash in them.
 */
export function buildRewindCards(bundle: RewindBundle): RewindCardKey[] {
  const { season, player } = bundle

  return CARD_ORDER.filter((key) => {
    if (!player && PLAYER_CARDS.has(key)) return false

    const group = groupOf(season, key)
    if (group) return hasAward(group)

    if (!player) return true
    if (key === 'journey') return player.journey.points.length > 1
    if (key === 'peak') return player.peak !== null && player.peak.matchId !== null
    if (key === 'badges') return player.badges.length > 0
    if (key === 'feats') {
      return (
        player.feats.biggestUpsetGap !== null ||
        player.feats.bestPartner !== null ||
        player.feats.nemesis !== null ||
        player.feats.mostFacedOpponent !== null
      )
    }
    return true
  })
}

/** Whole days left in the promotion window, floored at 0. */
export function daysUntil(target: Date, now: Date = new Date()): number {
  const ms = target.getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000))
}

export function formatSignedMmr(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

/** Shared date rendering for the deck, so every card reads the same way. */
export function formatRewindDate(value: Date | string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Groups an archive by discipline, preserving the newest-first order within each. */
export function groupArchiveByDiscipline(
  entries: RewindArchiveEntry[],
): { discipline: string | null; entries: RewindArchiveEntry[] }[] {
  const groups = new Map<string, { discipline: string | null; entries: RewindArchiveEntry[] }>()

  for (const entry of entries) {
    const key = entry.disciplineName ?? ''
    const group = groups.get(key) ?? { discipline: entry.disciplineName, entries: [] }
    group.entries.push(entry)
    groups.set(key, group)
  }
  return [...groups.values()]
}

// Shared across every caller: the home page banner, the season page auto-open and
// the stats entry all read the same promotion, so finishing the deck anywhere
// retires the banner everywhere without a round trip.
const promoted = ref<RewindPromotion | null>(null)
const promotedLoaded = ref(false)

export function useRewindService() {
  const bundle = ref<RewindBundle | null>(null)
  const archive = ref<RewindArchiveEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Cheap enough to call on every home render, but only fetched once per session. */
  async function loadPromoted(force = false): Promise<void> {
    if (promotedLoaded.value && !force) return
    try {
      promoted.value = await rewindApi.getPromoted()
      promotedLoaded.value = true
    } catch {
      // A missing promotion is not an error worth surfacing: the card simply
      // stays hidden and the archive remains reachable.
      promoted.value = null
    }
  }

  async function loadBundle(seasonId: string, authenticated = true): Promise<RewindBundle | null> {
    loading.value = true
    error.value = null
    try {
      bundle.value = authenticated
        ? await rewindApi.getMyRewind(seasonId)
        : await rewindApi.getSeasonRewind(seasonId)
      return bundle.value
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : i18n.global.t('rewindService.errors.loadFailed')
      return null
    } finally {
      loading.value = false
    }
  }

  async function loadArchive(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      archive.value = await rewindApi.listArchive()
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : i18n.global.t('rewindService.errors.loadArchiveFailed')
    } finally {
      loading.value = false
    }
  }

  /** Records the first open so the season page stops auto-opening the deck. */
  async function markOpened(seasonId: string): Promise<void> {
    if (promoted.value?.seasonId === seasonId && !promoted.value.openedAt) {
      promoted.value = { ...promoted.value, openedAt: new Date() }
    }
    await rewindApi.markOpened(seasonId).catch(() => undefined)
  }

  /** Called only when the deck is watched through: this is what retires the promo card. */
  async function markViewed(seasonId: string): Promise<void> {
    if (promoted.value?.seasonId === seasonId) promoted.value = null
    const entry = archive.value.find((item) => item.seasonId === seasonId)
    if (entry && !entry.viewedAt) entry.viewedAt = new Date()

    await rewindApi.markViewed(seasonId).catch(() => undefined)
  }

  return {
    promoted,
    bundle,
    archive,
    loading,
    error,
    loadPromoted,
    loadBundle,
    loadArchive,
    markOpened,
    markViewed,
  }
}
