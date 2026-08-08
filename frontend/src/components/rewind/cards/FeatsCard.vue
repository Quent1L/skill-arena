<template>
  <RewindCardShell
    :eyebrow="t('rewind.feats.eyebrow')"
    eyebrow-class="bg-orange-500/20 text-orange-300"
    :title="t('rewind.feats.title')"
  >
    <div class="flex flex-col gap-2">
      <div
        v-if="feats.biggestUpsetGap"
        class="flex flex-col gap-0.5 rounded-2xl bg-orange-500/10 px-4 py-3"
      >
        <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-orange-300">
          <i class="fa fa-bolt" />
          {{ t('rewind.feats.biggestUpset') }}
          <span class="rounded-full bg-orange-500/20 px-2 py-0.5 tabular-nums">
            {{ formatMatchup(feats.biggestUpsetGap.format) }}
          </span>
        </div>
        <div class="text-sm">
          {{
            t('rewind.feats.biggestUpsetText', {
              opponent: feats.biggestUpsetGap.opponent?.displayName ?? t('rewind.feats.anOpponent'),
              gap: feats.biggestUpsetGap.mmrGap,
            })
          }}
        </div>
      </div>

      <div
        v-if="feats.bestMmrGain"
        class="flex flex-col gap-0.5 rounded-2xl bg-emerald-500/10 px-4 py-3"
      >
        <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-300">
          <i class="fa fa-arrow-trend-up" />
          {{ t('rewind.feats.bestGain') }}
          <span class="rounded-full bg-emerald-500/20 px-2 py-0.5 tabular-nums">
            {{ formatMatchup(feats.bestMmrGain.format) }}
          </span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black tabular-nums text-emerald-400">
            +{{ feats.bestMmrGain.mmrDelta }}
          </span>
          <span class="text-xs uppercase tracking-widest text-gray-400">MMR</span>
        </div>
        <div class="text-sm text-gray-300">
          {{
            t('rewind.feats.bestGainText', {
              opponent: feats.bestMmrGain.opponent?.displayName ?? t('rewind.feats.anOpponent'),
              date: formatRewindDate(feats.bestMmrGain.playedAt, locale),
            })
          }}
        </div>
      </div>

      <!-- Two lines rather than one: the count needs the gap it was measured at
           to mean anything, and both on a single line read as a sentence with a
           number dropped in the middle. -->
      <div
        v-if="feats.giantKillerWins > 0"
        class="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-2.5"
      >
        <i class="fa fa-hammer w-4 shrink-0 text-center text-red-400" />
        <div class="min-w-0 flex-1">
          <div class="text-sm text-gray-300">{{ t('rewind.feats.giantKiller') }}</div>
          <div class="text-xs text-gray-400">{{ t('rewind.feats.giantKillerHint') }}</div>
        </div>
        <span class="shrink-0 text-lg font-black tabular-nums text-red-400">
          {{ feats.giantKillerWins }}
        </span>
      </div>

      <RelationRow
        v-if="feats.bestPartner"
        icon="fa fa-handshake"
        accent="text-teal-300"
        :label="t('rewind.feats.bestPartner')"
        :relation="feats.bestPartner"
      />
      <RelationRow
        v-if="feats.mostFacedOpponent"
        icon="fa fa-repeat"
        accent="text-sky-300"
        :label="t('rewind.feats.mostFaced')"
        :relation="feats.mostFacedOpponent"
      />
      <RelationRow
        v-if="feats.nemesis"
        icon="fa fa-skull"
        accent="text-gray-400"
        :label="t('rewind.feats.nemesis')"
        :relation="feats.nemesis"
      />
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload } from '@skol-arena/shared/types/index'
import RewindCardShell from '../RewindCardShell.vue'
import RelationRow from '../RelationRow.vue'
import { formatMatchup, formatRewindDate } from '@/composables/ranked/rewind.service'

const props = defineProps<{ player: PlayerRewindPayload }>()

const { t, locale } = useI18n()
const feats = computed(() => props.player.feats)
</script>
