import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import type { RewindBundle } from '@skol-arena/shared/types/index'
import { buildRewindCards, type RewindCardKey } from './rewind.service'

/** Guards against a held key or a double tap skipping two cards at once. */
const NAV_COOLDOWN_MS = 180

export interface UseRewindDeck {
  cards: ComputedRef<RewindCardKey[]>
  index: Ref<number>
  current: ComputedRef<RewindCardKey | null>
  isFirst: ComputedRef<boolean>
  isLast: ComputedRef<boolean>
  progress: ComputedRef<number>
  next: () => void
  previous: () => void
  goTo: (index: number) => void
}

/**
 * Navigation state for the rewind deck. Kept apart from the overlay component so
 * the ordering and completion rules can be tested without mounting anything.
 *
 * `onComplete` fires when the player moves past the last card — that, and not
 * merely opening the deck, is what counts as having watched the rewind.
 */
export function useRewindDeck(
  bundle: Ref<RewindBundle | null>,
  options: { onComplete?: () => void; onExit?: () => void } = {},
): UseRewindDeck {
  const index = ref(0)
  const cards = computed(() => (bundle.value ? buildRewindCards(bundle.value) : []))
  const current = computed(() => cards.value[index.value] ?? null)
  const isFirst = computed(() => index.value === 0)
  const isLast = computed(() => index.value >= cards.value.length - 1)
  const progress = computed(() =>
    cards.value.length === 0 ? 0 : (index.value + 1) / cards.value.length,
  )

  let lastNavAt = 0
  function throttled(): boolean {
    const now = Date.now()
    if (now - lastNavAt < NAV_COOLDOWN_MS) return true
    lastNavAt = now
    return false
  }

  function next(): void {
    if (throttled()) return
    // Only a forward move made *from* the last card completes the deck. Landing
    // on it must not, or the conclusion would be marked read before it is shown.
    if (isLast.value) {
      options.onComplete?.()
      return
    }
    index.value++
  }

  function previous(): void {
    if (throttled() || isFirst.value) return
    index.value--
  }

  function goTo(target: number): void {
    if (target < 0 || target >= cards.value.length) return
    index.value = target
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === ' ') {
      event.preventDefault()
      next()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      previous()
    } else if (event.key === 'Escape') {
      options.onExit?.()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  return { cards, index, current, isFirst, isLast, progress, next, previous, goTo }
}
