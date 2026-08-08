<template>
  <RewindCardShell
    :eyebrow="t('rewind.peak.eyebrow')"
    eyebrow-class="bg-purple-500/20 text-purple-300"
    :title="t('rewind.peak.title')"
  >
    <div class="flex flex-col items-center gap-2">
      <div class="relative flex h-20 w-20 items-center justify-center">
        <div class="absolute inset-0 rounded-full bg-purple-500/20 blur-2xl" />
        <i class="fa fa-mountain relative text-4xl text-purple-300" />
      </div>

      <span class="text-4xl font-black tabular-nums text-purple-300">{{ peak }}</span>
      <span class="text-xs uppercase tracking-widest text-gray-400">MMR</span>

      <!-- The tier the peak sat in — not always the one the season ended on. -->
      <RewindTierBadge v-if="player.peak?.tier" :tier="player.peak.tier" />

      <p v-if="player.peak?.playedAt" class="text-sm text-gray-400">
        {{ t('rewind.peak.reachedOn', { date: formattedDate }) }}
      </p>
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload } from '@skol-arena/shared/types/index'
import { useCountUp } from '@/composables/ui/useCountUp'
import { formatRewindDate } from '@/composables/ranked/rewind.service'
import RewindCardShell from '../RewindCardShell.vue'
import RewindTierBadge from '../RewindTierBadge.vue'

const props = defineProps<{ player: PlayerRewindPayload }>()

const { t, locale } = useI18n()

const { value: peak } = useCountUp(toRef(props.player.peak!, 'mmr'), {
  from: props.player.journey.initialMmr,
})

const formattedDate = computed(() =>
  props.player.peak?.playedAt ? formatRewindDate(props.player.peak.playedAt, locale.value) : '',
)
</script>
