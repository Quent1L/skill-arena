<template>
  <RewindCardShell
    :eyebrow="t('rewind.bestRank.eyebrow')"
    :title="t('rewind.bestRank.title')"
    :subtitle="t('rewind.bestRank.subtitle')"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col items-center gap-1 rounded-3xl bg-white/5 px-5 py-6">
        <i class="fa fa-ranking-star text-3xl text-cyan-300" />
        <span class="text-5xl font-black tabular-nums text-cyan-300">#{{ best }}</span>
        <span class="text-xs uppercase tracking-wide text-gray-400">
          {{ t('rewind.bestRank.peakPosition') }}
        </span>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <RewindStat
          :value="player.bestRank.matchesInTop1"
          :label="t('rewind.bestRank.top1')"
          value-class="text-amber-300"
        />
        <RewindStat
          :value="player.bestRank.matchesInTop3"
          :label="t('rewind.bestRank.top3')"
          value-class="text-fuchsia-300"
        />
        <RewindStat
          :value="player.bestRank.matchesInTop5"
          :label="t('rewind.bestRank.top5')"
          value-class="text-cyan-300"
        />
      </div>

      <p class="text-center text-xs text-gray-500">{{ t('rewind.bestRank.measuredInMatches') }}</p>
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload } from '@skol-arena/shared/types/index'
import { useCountUp } from '@/composables/ui/useCountUp'
import RewindCardShell from '../RewindCardShell.vue'
import RewindStat from '../RewindStat.vue'

const props = defineProps<{ player: PlayerRewindPayload }>()

const { t } = useI18n()
const { value: best } = useCountUp(toRef(props.player.bestRank, 'bestRank'), {
  from: props.player.finalRank.totalPlayers,
})
</script>
