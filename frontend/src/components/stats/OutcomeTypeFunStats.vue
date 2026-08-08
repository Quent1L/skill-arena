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
        <OutcomeTypeLeaderColumn
          :board="volumeOf(stat)"
          metric="volume"
          :side="side"
          :tournament-id="tournamentId"
        />
        <OutcomeTypeLeaderColumn
          :board="rateOf(stat)"
          metric="rate"
          :side="side"
          :tournament-id="tournamentId"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SelectButton from 'primevue/selectbutton'
import type { OutcomeTypeFunStat, OutcomeTypeLeaderboard } from '@skol-arena/shared/types/index'
import OutcomeTypeLeaderColumn from '@/components/stats/OutcomeTypeLeaderColumn.vue'

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

function volumeOf(stat: OutcomeTypeFunStat): OutcomeTypeLeaderboard {
  return side.value === 'winners' ? stat.topWinnersByVolume : stat.topLosersByVolume
}

function rateOf(stat: OutcomeTypeFunStat): OutcomeTypeLeaderboard {
  return side.value === 'winners' ? stat.topWinnersByRate : stat.topLosersByRate
}

/** "Rois de Fin normale" / "Victimes de Fin normale" — keeps the fun framing of the card. */
function cardTitle(stat: OutcomeTypeFunStat): string {
  const key = side.value === 'winners' ? 'king' : 'victim'
  return t(`tournamentStatsTab.outcomeTypeFunStats.${key}`, { name: stat.outcomeTypeName })
}
</script>
