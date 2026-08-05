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
        class="flex flex-col gap-2 rounded-2xl bg-white/5 px-4 py-3"
      >
        <div class="flex items-baseline justify-between">
          <span class="text-xs uppercase tracking-wide text-gray-400">{{ row.label }}</span>
          <span class="text-lg font-black tabular-nums text-teal-300">
            {{ t('rewind.percentiles.top', { percent: row.value }) }}
          </span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
          <!-- Filled from the right: a smaller percentile is a longer bar. -->
          <div
            class="ml-auto h-full rounded-full bg-teal-400 transition-[width] duration-1000 ease-out"
            :style="{ width: mounted ? `${100 - row.value}%` : '0%' }"
          />
        </div>
      </div>
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload } from '@skol-arena/shared/types/index'
import RewindCardShell from '../RewindCardShell.vue'

const props = defineProps<{ player: PlayerRewindPayload }>()

const { t } = useI18n()

const rows = computed(() => [
  { key: 'matchesPlayed', label: t('rewind.percentiles.matches'), value: props.player.percentiles.matchesPlayed },
  { key: 'winRate', label: t('rewind.percentiles.winRate'), value: props.player.percentiles.winRate },
  { key: 'progression', label: t('rewind.percentiles.progression'), value: props.player.percentiles.progression },
  { key: 'winStreak', label: t('rewind.percentiles.winStreak'), value: props.player.percentiles.winStreak },
])

const mounted = ref(false)
onMounted(() => requestAnimationFrame(() => (mounted.value = true)))
</script>
