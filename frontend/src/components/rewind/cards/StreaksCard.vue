<template>
  <RewindCardShell
    :eyebrow="t('rewind.streaks.eyebrow')"
    eyebrow-class="bg-rose-500/20 text-rose-300"
    :title="t('rewind.streaks.title')"
    :subtitle="t('rewind.streaks.subtitle')"
  >
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-4 rounded-3xl bg-white/5 px-5 py-5">
        <i class="fa fa-fire text-4xl text-rose-400" />
        <div class="flex flex-col">
          <span class="text-4xl font-black tabular-nums text-rose-400">{{ winStreak }}</span>
          <span class="text-xs uppercase tracking-wide text-gray-400">
            {{ t('rewind.streaks.wins') }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <RewindStat
          :value="player.streaks.bestUnbeatenStreak"
          :label="t('rewind.streaks.unbeaten')"
          value-class="text-emerald-400"
        />
        <RewindStat
          :value="player.streaks.worstLossStreak"
          :label="t('rewind.streaks.losses')"
          value-class="text-gray-400"
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

const props = defineProps<{ player: PlayerRewindPayload }>()

const { t } = useI18n()
const { value: winStreak } = useCountUp(toRef(props.player.streaks, 'bestWinStreak'))
</script>
