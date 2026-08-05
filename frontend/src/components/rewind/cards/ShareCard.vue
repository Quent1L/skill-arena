<template>
  <RewindCardShell
    :eyebrow="t('rewind.share.eyebrow')"
    :title="t('rewind.share.title')"
    :subtitle="t('rewind.share.subtitle')"
  >
    <div class="flex flex-col gap-4">
      <!-- The exported node. Colours are literal rather than theme tokens: this
           card is rendered outside the app, in whatever viewer opens the PNG. -->
      <div
        ref="cardRef"
        class="flex flex-col gap-4 rounded-3xl px-5 py-6"
        style="background: linear-gradient(160deg, #1e1b4b 0%, #0b0b12 100%); color: #ffffff"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-black tracking-tight" style="color: #a5b4fc">SKOL Arena</span>
          <span class="text-[11px] uppercase tracking-widest" style="color: #6b7280">
            {{ season.season.name }}
          </span>
        </div>

        <div class="flex items-center gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-black"
            style="background: #4338ca"
          >
            {{ initials }}
          </div>
          <div class="min-w-0">
            <div class="truncate text-lg font-black">{{ player.player.displayName }}</div>
            <div class="text-xs" style="color: #9ca3af">
              {{ player.finalRank.tierName ?? t('rewind.share.unranked') }}
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div v-for="line in lines" :key="line.label" class="flex items-center gap-2 text-sm">
            <span class="w-5 text-center">{{ line.emoji }}</span>
            <span class="flex-1" style="color: #d1d5db">{{ line.label }}</span>
            <span class="font-black tabular-nums">{{ line.value }}</span>
          </div>
        </div>
      </div>

      <!-- z-30 keeps this above the deck's mobile tap zones (z-20), which would
           otherwise turn a tap on the button's edge into "next card". -->
      <button
        class="relative z-30 flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold transition-colors hover:bg-indigo-400 disabled:opacity-60"
        :disabled="state === 'working'"
        @click="onShare"
      >
        <i :class="buttonIcon" />
        {{ buttonLabel }}
      </button>

      <p v-if="state === 'failed'" class="text-center text-xs text-rose-400">
        {{ t('rewind.share.failed') }}
      </p>
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload, SeasonRewindPayload } from '@skol-arena/shared/types/index'
import { useRewindShare } from '@/composables/ranked/useRewindShare'
import RewindCardShell from '../RewindCardShell.vue'

const props = defineProps<{ player: PlayerRewindPayload; season: SeasonRewindPayload }>()

const { t } = useI18n()
const cardRef = useTemplateRef<HTMLElement>('cardRef')
const { state, share } = useRewindShare(cardRef)

const initials = computed(() =>
  props.player.player.shortName.slice(0, 2).toUpperCase(),
)

const lines = computed(() => {
  const { finalRank, journey, peak, streaks, totals } = props.player
  const rows = [
    { emoji: '🏆', label: t('rewind.share.finalRank'), value: `#${finalRank.rank}` },
    {
      emoji: '📈',
      label: t('rewind.share.mmr'),
      value: `${journey.netDelta > 0 ? '+' : ''}${journey.netDelta}`,
    },
    { emoji: '⚔️', label: t('rewind.share.matches'), value: `${totals.matchesPlayed}` },
  ]

  if (peak?.matchId) {
    rows.splice(2, 0, { emoji: '🏔', label: t('rewind.share.peak'), value: `${peak.mmr}` })
  }
  if (streaks.bestWinStreak > 1) {
    rows.push({
      emoji: '🔥',
      label: t('rewind.share.streak'),
      value: `${streaks.bestWinStreak}`,
    })
  }
  return rows
})

const buttonIcon = computed(() => {
  if (state.value === 'working') return 'fa fa-spinner fa-spin'
  if (state.value === 'shared' || state.value === 'downloaded') return 'fa fa-check'
  return 'fa fa-share-nodes'
})

const buttonLabel = computed(() => {
  if (state.value === 'working') return t('rewind.share.working')
  if (state.value === 'shared') return t('rewind.share.shared')
  if (state.value === 'downloaded') return t('rewind.share.downloaded')
  return t('rewind.share.action')
})

function onShare(): void {
  const slug = props.season.season.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  void share(`skol-rewind-${slug}.png`)
}
</script>
