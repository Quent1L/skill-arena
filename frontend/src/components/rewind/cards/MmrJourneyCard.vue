<template>
  <RewindCardShell
    :eyebrow="t('rewind.journey.eyebrow')"
    :title="t('rewind.journey.title')"
    :subtitle="t('rewind.journey.subtitle')"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-4">
        <div class="flex flex-col items-center gap-1">
          <span class="text-[11px] uppercase tracking-wide text-gray-400">
            {{ t('rewind.journey.start') }}
          </span>
          <span class="text-xl font-bold tabular-nums text-gray-300">
            {{ player.journey.initialMmr }}
          </span>
        </div>

        <i class="fa fa-arrow-right text-gray-600" />

        <div class="flex flex-col items-center gap-1">
          <span class="text-[11px] uppercase tracking-wide text-gray-400">
            {{ t('rewind.journey.end') }}
          </span>
          <span class="text-xl font-bold tabular-nums">{{ player.journey.finalMmr }}</span>
        </div>
      </div>

      <RewindStat
        :value="player.journey.netDelta"
        :label="t('rewind.journey.netDelta')"
        :prefix="player.journey.netDelta > 0 ? '+' : ''"
        :value-class="player.journey.netDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'"
      />

      <div class="h-40 rounded-2xl bg-white/5 p-2">
        <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
      </div>
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Chart from 'primevue/chart'
import type { PlayerRewindPayload } from '@skol-arena/shared/types/index'
import RewindCardShell from '../RewindCardShell.vue'
import RewindStat from '../RewindStat.vue'
import { formatRewindDate } from '@/composables/ranked/rewind.service'

const props = defineProps<{ player: PlayerRewindPayload }>()

const { t, locale } = useI18n()

const points = computed(() => props.player.journey.points)

const chartData = computed(() => ({
  labels: points.value.map((_, index) => index + 1),
  datasets: [
    {
      data: points.value.map((point) => point.mmrAfter),
      borderColor: '#6366f1',
      borderWidth: 2,
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
    },
  ],
}))

// The line draws itself left to right: each point waits its turn, which is the
// closest Chart.js gets to a hand-drawn reveal without a second library.
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 900,
    easing: 'easeOutQuart',
    delay: (context: { type: string; dataIndex: number }) =>
      context.type === 'data' ? context.dataIndex * (900 / Math.max(points.value.length, 1)) : 0,
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: { dataIndex: number }[]) =>
          formatRewindDate(points.value[items[0].dataIndex].playedAt, locale.value),
        label: (item: { dataIndex: number }) => {
          const point = points.value[item.dataIndex]
          return `${point.mmrAfter} MMR (${point.mmrDelta > 0 ? '+' : ''}${point.mmrDelta})`
        },
      },
    },
  },
  scales: {
    x: { display: false },
    y: {
      grid: { color: 'rgba(255,255,255,0.08)' },
      ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
    },
  },
}))
</script>
