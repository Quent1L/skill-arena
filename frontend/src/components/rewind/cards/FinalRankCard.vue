<template>
  <RewindCardShell :eyebrow="t('rewind.finalRank.eyebrow')" :title="t('rewind.finalRank.title')">
    <div class="flex flex-col items-center gap-3">
      <RewindTierBadge v-if="player.finalRank.tier" :tier="player.finalRank.tier" size="lg" />

      <div class="relative flex h-24 w-24 items-center justify-center">
        <div class="absolute inset-0 rounded-full bg-amber-400/15 blur-2xl" />
        <div class="relative flex flex-col items-center">
          <span class="text-xs uppercase tracking-widest text-gray-400">#</span>
          <span class="text-5xl font-black tabular-nums text-amber-300">{{ rank }}</span>
        </div>
      </div>

      <p class="text-center text-sm text-gray-400">
        {{ t('rewind.finalRank.outOf', { total: player.finalRank.totalPlayers }) }}
      </p>

      <div class="grid w-full grid-cols-2 gap-2">
        <RewindStat :value="player.finalRank.mmr" :label="t('rewind.finalRank.finalMmr')" />
        <RewindStat
          :value="player.bestRank.bestRank"
          :label="t('rewind.finalRank.bestRank')"
          prefix="#"
        />
      </div>
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
import RewindTierBadge from '../RewindTierBadge.vue'

const props = defineProps<{ player: PlayerRewindPayload }>()

const { t } = useI18n()

// Counts down to the final position: ranks read better falling into place than
// climbing from zero.
const { value: rank } = useCountUp(toRef(props.player.finalRank, 'rank'), {
  from: props.player.finalRank.totalPlayers,
})
</script>
