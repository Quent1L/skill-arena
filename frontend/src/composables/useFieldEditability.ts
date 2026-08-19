import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { TournamentEditability } from '@skol-arena/shared/types/index'

/**
 * Why a field is the way it is, for a form that has to explain itself.
 *
 * Fields used to be greyed out with no reason given, and the list driving that
 * disagreed with what the API accepted. Both come from the backend now, so the
 * form can say "locked because 12 results are in" instead of leaving the admin
 * guessing at a disabled input.
 *
 * `null` editability means an unconstrained form — creation — where everything
 * is open.
 */
export function useFieldEditability(
  source: MaybeRefOrGetter<TournamentEditability | null | undefined>,
) {
  const editability = computed(() => toValue(source) ?? null)

  function canEdit(field: string): boolean {
    const value = editability.value
    if (!value) return true
    return value.editable.includes(field)
  }

  /** Editable, but saving it recomputes results that are already published. */
  function triggersRecalculation(field: string): boolean {
    return editability.value?.recalculating.includes(field) ?? false
  }

  /**
   * Locked because results came in, as opposed to locked by how the competition
   * is built — the first is worth a number, the second is just permanent.
   */
  function lockedByMatches(field: string): boolean {
    const value = editability.value
    if (!value || value.enteredMatchCount === 0) return false
    return value.locked.includes(field)
  }

  const enteredMatchCount = computed(() => editability.value?.enteredMatchCount ?? 0)

  return { canEdit, triggersRecalculation, lockedByMatches, enteredMatchCount }
}
