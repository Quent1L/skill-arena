<template>
  <RewindCardShell
    :eyebrow="t('rewind.percentiles.eyebrow')"
    eyebrow-class="bg-teal-500/20 text-teal-300"
    :title="t('rewind.percentiles.title')"
    :subtitle="t('rewind.percentiles.subtitle')"
  >
    <div class="flex flex-col gap-2">
      <div
        v-for="row in rows"
        :key="row.key"
        class="flex flex-col gap-1.5 rounded-2xl bg-white/5 px-4 py-2.5"
      >
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-xs uppercase tracking-wide text-gray-300">{{ row.label }}</span>
          <!-- The absolute position leads: "top 25 %" of eight players is second. -->
          <span class="text-right">
            <span class="text-lg font-black tabular-nums text-teal-300">
              {{ t('rewind.percentiles.position', { rank: row.rank, total: row.poolSize }) }}
            </span>
            <span class="ml-2 text-sm tabular-nums text-gray-300">
              {{ t('rewind.percentiles.top', { percent: row.topPercent }) }}
            </span>
          </span>
        </div>

        <!-- Filled left to right on how much of the field is behind the player:
             a longer bar is a better standing. The figure itself is not printed
             — it is the complement of the "top X %" already on the line, and a
             fourth line per metric is what pushed this card past the fold. -->
        <div
          class="h-1.5 overflow-hidden rounded-full bg-white/10"
          :title="t('rewind.percentiles.betterThan', { percent: row.betterThan })"
        >
          <div
            class="h-full rounded-full bg-teal-400 transition-[width] duration-1000 ease-out"
            :style="{ width: mounted ? `${row.betterThan}%` : '0%' }"
          />
        </div>
      </div>
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload, RewindPercentileEntry } from '@skol-arena/shared/types/index'
import RewindCardShell from '../RewindCardShell.vue'

const props = defineProps<{ player: PlayerRewindPayload }>()

const { t } = useI18n()

/** Share of the pool the player finished ahead of — what the bar draws. */
function betterThan(entry: RewindPercentileEntry): number {
  if (entry.poolSize <= 1) return 100
  return Math.round(((entry.poolSize - entry.rank) / entry.poolSize) * 100)
}

function row(key: string, label: string, entry: RewindPercentileEntry) {
  return { key, label, ...entry, betterThan: betterThan(entry) }
}

const rows = computed(() => {
  const percentiles = props.player.percentiles
  return [
    row('matchesPlayed', t('rewind.percentiles.matches'), percentiles.matchesPlayed),
    row('winRate', t('rewind.percentiles.winRate'), percentiles.winRate),
    row('progression', t('rewind.percentiles.progression'), percentiles.progression),
    row('winStreak', t('rewind.percentiles.winStreak'), percentiles.winStreak),
  ]
})

const mounted = ref(false)
onMounted(() => requestAnimationFrame(() => (mounted.value = true)))
</script>
