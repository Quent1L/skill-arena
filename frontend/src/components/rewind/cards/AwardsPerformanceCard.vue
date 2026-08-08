<template>
  <RewindCardShell
    :eyebrow="t('rewind.awards.eyebrow')"
    eyebrow-class="bg-amber-500/20 text-amber-300"
    :title="t('rewind.awards.performance.title')"
    :subtitle="t('rewind.awards.performance.subtitle')"
  >
    <AwardHero
      v-if="season.performance.king"
      :label="t('rewind.awards.performance.king')"
      :player-name="season.performance.king.player.displayName"
      :value="season.performance.king.value"
      :icon="AWARD_STYLE.king.icon"
      :accent="AWARD_STYLE.king.accent"
      :detail="t('rewind.awards.matchesPlayed', season.performance.king.detail ?? 0)"
      :is-mine="won.has('king')"
      suffix=" MMR"
    />

    <div class="flex flex-col gap-2">
      <AwardRow
        v-if="season.performance.peakMmr"
        :label="t('rewind.awards.performance.peak')"
        :player-name="season.performance.peakMmr.player.displayName"
        :value="season.performance.peakMmr.value"
        :icon="AWARD_STYLE.peakMmr.icon"
        :accent="AWARD_STYLE.peakMmr.accent"
        :is-mine="won.has('peakMmr')"
        suffix=" MMR"
      />
      <AwardRow
        v-if="season.performance.progression"
        :label="t('rewind.awards.performance.progression')"
        :player-name="season.performance.progression.player.displayName"
        :value="season.performance.progression.value"
        :icon="AWARD_STYLE.progression.icon"
        :accent="AWARD_STYLE.progression.accent"
        :is-mine="won.has('progression')"
        prefix="+"
        suffix=" MMR"
      />
      <AwardRow
        v-if="season.performance.sniper"
        :label="t('rewind.awards.performance.sniper')"
        :player-name="season.performance.sniper.player.displayName"
        :value="season.performance.sniper.value"
        :icon="AWARD_STYLE.sniper.icon"
        :accent="AWARD_STYLE.sniper.accent"
        :detail="t('rewind.awards.matchesPlayed', season.performance.sniper.detail ?? 0)"
        :is-mine="won.has('sniper')"
        suffix=" %"
      />
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RewindAwardKey, SeasonRewindPayload } from '@skol-arena/shared/types/index'
import RewindCardShell from '../RewindCardShell.vue'
import AwardHero from '../AwardHero.vue'
import AwardRow from '../AwardRow.vue'
import { AWARD_STYLE } from '../award-display'

const props = withDefaults(
  defineProps<{ season: SeasonRewindPayload; awardsWon?: RewindAwardKey[] }>(),
  { awardsWon: () => [] },
)

const { t } = useI18n()
const won = computed(() => new Set(props.awardsWon))
</script>
