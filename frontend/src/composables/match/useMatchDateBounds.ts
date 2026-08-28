import { computed, type Ref } from 'vue'
import type { ClientBaseTournament } from '@skol-arena/shared/types/index'
import { useConfigService } from '@/composables/config/config.service'

/** Server default, used until GET /config has landed. Mirrors backend/src/config/ranked.ts. */
const FALLBACK_MATCH_MAX_AGE_HOURS = 48

/**
 * Date range the match form's picker accepts.
 *
 * A ranked match can only be reported for a limited time after it was played, so the
 * floor is the later of the season start and that window. The window itself is a
 * server setting (`RANKED_MATCH_MAX_AGE_HOURS`) served by GET /config — `0` means the
 * server enforces no limit, and the picker then opens back to the season start.
 *
 * This is a UI convenience only: `WhenStep` enables `manualInput`, so the real
 * enforcement stays server-side.
 */
export function useMatchDateBounds(tournament: Ref<ClientBaseTournament | null>) {
  const { config } = useConfigService()

  const rankedMaxAgeHours = computed(
    () => config.value?.ranked.matchMaxAgeHours ?? FALLBACK_MATCH_MAX_AGE_HOURS,
  )

  const minDate = computed<Date | undefined>(() => {
    if (tournament.value?.mode !== 'ranked') return tournament.value?.startDate ?? undefined

    const startDate = tournament.value.startDate ?? undefined
    if (rankedMaxAgeHours.value === 0) return startDate

    const windowStart = new Date(Date.now() - rankedMaxAgeHours.value * 60 * 60 * 1000)
    return startDate && startDate > windowStart ? startDate : windowStart
  })

  const maxDate = computed<Date | undefined>(() => tournament.value?.endDate ?? undefined)

  return { minDate, maxDate }
}
