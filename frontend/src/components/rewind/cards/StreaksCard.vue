<template>
  <RewindCardShell
    :eyebrow="t('rewind.streaks.eyebrow')"
    eyebrow-class="bg-rose-500/20 text-rose-300"
    :title="t('rewind.streaks.title')"
    :subtitle="t('rewind.streaks.subtitle')"
  >
    <div class="flex flex-col gap-2.5">
      <!-- Wins and losses get the exact same block: they are the two halves of
           the same story, and one of them shrinking to a lone tile — which is
           what happened on a season without draws — read like a leftover. -->
      <div
        v-for="run in runs"
        :key="run.key"
        class="flex items-center gap-4 rounded-3xl bg-white/5 px-5 py-3"
      >
        <i :class="[run.icon, run.accent]" class="text-3xl" />

        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-3xl font-black leading-none tabular-nums" :class="run.accent">
            {{ run.count }}
          </span>
          <span class="text-xs uppercase tracking-wide text-gray-300">{{ run.label }}</span>
        </div>

        <!-- What the run was actually worth: six wins against even opposition and
             six against the top of the ladder are not the same season. -->
        <div v-if="run.mmr !== 0" class="shrink-0 text-right">
          <div class="text-lg font-black leading-none tabular-nums" :class="run.accent">
            {{ run.mmr > 0 ? '+' : '' }}{{ run.mmr }}
          </div>
          <div class="text-xs uppercase tracking-widest text-gray-400">
            {{ t('rewind.streaks.onTheRun') }}
          </div>
        </div>
      </div>

      <!-- Without draws an unbeaten run is a win run: showing both would print
           the same number twice under two names. -->
      <RewindStat
        v-if="allowDraw"
        :value="player.streaks.bestUnbeatenStreak"
        :label="t('rewind.streaks.unbeaten')"
        icon="fa fa-shield"
        value-class="text-emerald-400"
      />
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload } from '@skol-arena/shared/types/index'
import { useCountUp } from '@/composables/ui/useCountUp'
import RewindCardShell from '../RewindCardShell.vue'
import RewindStat from '../RewindStat.vue'

const props = withDefaults(defineProps<{ player: PlayerRewindPayload; allowDraw?: boolean }>(), {
  allowDraw: true,
})

const { t } = useI18n()
const streaks = computed(() => props.player.streaks)

const { value: winStreak } = useCountUp(toRef(props.player.streaks, 'bestWinStreak'))
const { value: lossStreak } = useCountUp(toRef(props.player.streaks, 'worstLossStreak'))

const runs = computed(() => [
  {
    key: 'wins',
    icon: 'fa fa-fire',
    accent: 'text-rose-400',
    count: winStreak.value,
    label: t('rewind.streaks.wins'),
    mmr: streaks.value.bestWinStreakMmr,
  },
  {
    key: 'losses',
    icon: 'fa fa-skull',
    accent: 'text-gray-400',
    count: lossStreak.value,
    label: t('rewind.streaks.losses'),
    mmr: streaks.value.worstLossStreakMmr,
  },
])
</script>
