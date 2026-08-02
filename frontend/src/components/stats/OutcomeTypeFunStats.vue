<template>
  <div class="space-y-4">
    <div class="flex justify-center">
      <SelectButton
        v-model="side"
        :options="sideOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        size="small"
      />
    </div>

    <div
      v-for="stat in stats"
      :key="stat.outcomeTypeId"
      class="rounded-xl p-4 bg-gray-900/40 border border-gray-700/60"
      data-test="outcome-type-card"
    >
      <div class="flex items-baseline justify-between gap-2 mb-3">
        <h3 class="text-sm font-bold text-gray-200 uppercase tracking-wide truncate">
          {{ cardTitle(stat) }}
        </h3>
        <span class="text-[10px] text-gray-500 shrink-0 tabular-nums">
          {{ t('tournamentStatsTab.outcomeTypeFunStats.matchCount', { count: stat.totalMatches }) }}
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <!-- Volume -->
        <div>
          <div
            class="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wide mb-2"
          >
            <i :class="volumeIcon" />
            {{ t('tournamentStatsTab.outcomeTypeFunStats.volume') }}
          </div>
          <div v-if="volumeOf(stat).length" data-test="volume-list">
            <div
              v-for="(p, i) in volumeOf(stat)"
              :key="p.playerId"
              class="py-1.5 border-b border-gray-700 last:border-0"
            >
              <div class="flex justify-between items-center gap-2">
                <RouterLink
                  :to="playerLink(p.playerId, tournamentId)"
                  class="flex items-center gap-2 min-w-0 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                >
                  <span
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    :class="podiumClass(i)"
                    >{{ i + 1 }}</span
                  >
                  <PlayerAvatar
                    :name="p.displayName"
                    :color-key="p.shortName"
                    size="xs"
                    shape="square"
                    class="shrink-0"
                  />
                  <span class="truncate">{{ p.displayName }}</span>
                </RouterLink>
                <span class="text-sm font-semibold text-gray-100 tabular-nums shrink-0">{{
                  countLabel(p.count)
                }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1 pl-7">
                <div class="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="volumeBarClass"
                    :style="{ width: `${relativeWidth(p.count, volumeOf(stat)[0].count)}%` }"
                  />
                </div>
                <span class="text-[10px] text-gray-500 tabular-nums shrink-0">
                  {{
                    t('tournamentStatsTab.outcomeTypeFunStats.shareOfTotal', { pct: p.sharePct })
                  }}
                </span>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-gray-500 py-1.5">
            {{ t('tournamentStatsTab.outcomeTypeFunStats.noRateData') }}
          </p>
        </div>

        <!-- Efficiency -->
        <div>
          <div
            class="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wide mb-2"
          >
            <i :class="rateIcon" />
            {{ rateTitle }}

            <span
              v-if="isLowSample(stat)"
              class="inline-flex items-center gap-1 text-[10px] leading-none text-amber-400/80 min-w-0"
              data-test="low-sample-badge"
            >
              <i class="fa fa-triangle-exclamation shrink-0" />
              <span class="truncate">{{
                t('tournamentStatsTab.outcomeTypeFunStats.lowSample', {
                  count: MIN_WEIGHTED_RATE_MATCHES,
                })
              }}</span>
            </span>

            <InfoTooltip :text="rateTooltip(stat)" />
          </div>

          <div v-if="rateOf(stat).length" data-test="rate-list">
            <div
              v-for="(p, i) in rateOf(stat)"
              :key="p.playerId"
              class="py-1.5 border-b border-gray-700 last:border-0"
            >
              <div class="flex justify-between items-center gap-2">
                <RouterLink
                  :to="playerLink(p.playerId, tournamentId)"
                  class="flex items-center gap-2 min-w-0 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                >
                  <span
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    :class="podiumClass(i)"
                    >{{ i + 1 }}</span
                  >
                  <PlayerAvatar
                    :name="p.displayName"
                    :color-key="p.shortName"
                    size="xs"
                    shape="square"
                    class="shrink-0"
                  />
                  <span class="truncate">{{ p.displayName }}</span>
                </RouterLink>
                <span class="text-sm font-semibold text-gray-100 tabular-nums shrink-0"
                  >{{ p.ratePct }} %</span
                >
              </div>
              <div class="flex items-center gap-2 mt-1 pl-7">
                <div class="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="rateBarClass"
                    :style="{ width: `${p.ratePct}%` }"
                  />
                </div>
                <span class="text-[10px] text-gray-500 tabular-nums shrink-0">
                  {{
                    t('tournamentStatsTab.outcomeTypeFunStats.matchCount', {
                      count: p.matchesPlayed,
                    })
                  }}
                </span>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-gray-500 py-1.5">
            {{ t('tournamentStatsTab.outcomeTypeFunStats.noRateData') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SelectButton from 'primevue/selectbutton'
import type { OutcomeTypeFunStat, OutcomeTypeLeader } from '@skol-arena/shared/types/index'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import InfoTooltip from '@/components/InfoTooltip.vue'
import { playerLink } from '@/utils/player-link'

/** Mirrors MIN_WEIGHTED_RATE_MATCHES in backend/src/services/stats-ranking.ts */
const MIN_WEIGHTED_RATE_MATCHES = 3

defineProps<{
  stats: OutcomeTypeFunStat[]
  tournamentId?: string | null
}>()

const { t } = useI18n()

const side = ref<'winners' | 'losers'>('winners')

const sideOptions = computed(() => [
  { label: t('tournamentStatsTab.outcomeTypeFunStats.winners'), value: 'winners' },
  { label: t('tournamentStatsTab.outcomeTypeFunStats.losers'), value: 'losers' },
])

function volumeOf(stat: OutcomeTypeFunStat): OutcomeTypeLeader[] {
  return side.value === 'winners' ? stat.topWinnersByVolume : stat.topLosersByVolume
}

function rateOf(stat: OutcomeTypeFunStat): OutcomeTypeLeader[] {
  return side.value === 'winners' ? stat.topWinnersByRate : stat.topLosersByRate
}

function isLowSample(stat: OutcomeTypeFunStat): boolean {
  return side.value === 'winners' ? stat.winnersRateIsLowSample : stat.losersRateIsLowSample
}

/** "Rois de Fin normale" / "Victimes de Fin normale" — keeps the fun framing of the card. */
function cardTitle(stat: OutcomeTypeFunStat): string {
  const key = side.value === 'winners' ? 'king' : 'victim'
  return t(`tournamentStatsTab.outcomeTypeFunStats.${key}`, { name: stat.outcomeTypeName })
}

function countLabel(count: number): string {
  const key = side.value === 'winners' ? 'winCount' : 'lossCount'
  return t(`tournamentStatsTab.outcomeTypeFunStats.${key}`, { count })
}

// A high loss rate is not "efficiency" — the rate column changes meaning with the side.
const rateTitle = computed(() =>
  t(
    side.value === 'winners'
      ? 'tournamentStatsTab.outcomeTypeFunStats.efficiency'
      : 'tournamentStatsTab.outcomeTypeFunStats.vulnerability',
  ),
)

function rateTooltip(stat: OutcomeTypeFunStat): string {
  const key = isLowSample(stat)
    ? 'lowSampleTooltip'
    : side.value === 'winners'
      ? 'efficiencyTooltip'
      : 'vulnerabilityTooltip'
  return t(`tournamentStatsTab.outcomeTypeFunStats.${key}`, { count: MIN_WEIGHTED_RATE_MATCHES })
}

const volumeIcon = computed(() =>
  side.value === 'winners' ? 'fa fa-trophy text-amber-500' : 'fa fa-skull text-gray-400',
)

const rateIcon = computed(() =>
  side.value === 'winners' ? 'fa fa-bullseye text-emerald-500' : 'fa fa-heart-crack text-red-400',
)

const volumeBarClass = computed(() => (side.value === 'winners' ? 'bg-amber-500' : 'bg-gray-500'))

const rateBarClass = computed(() => (side.value === 'winners' ? 'bg-emerald-500' : 'bg-red-500'))

/** Bar width relative to the column leader, so gaps read at a glance. */
function relativeWidth(count: number, leaderCount: number): number {
  if (leaderCount <= 0) return 0
  return Math.round((count / leaderCount) * 100)
}

function podiumClass(i: number): string {
  if (i === 0) return 'bg-yellow-400 text-yellow-900'
  if (i === 1) return 'bg-gray-300 text-gray-700'
  return 'bg-amber-600 text-white'
}
</script>
