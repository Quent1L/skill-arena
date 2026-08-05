<template>
  <RewindCardShell
    :eyebrow="t('rewind.awards.eyebrow')"
    eyebrow-class="bg-sky-500/20 text-sky-300"
    :title="t('rewind.awards.endurance.title')"
    :subtitle="t('rewind.awards.endurance.subtitle')"
  >
    <AwardHero
      v-if="season.endurance.marathon"
      :label="t('rewind.awards.endurance.marathon')"
      :player-name="season.endurance.marathon.player.displayName"
      :value="season.endurance.marathon.value"
      :icon="AWARD_STYLE.marathon.icon"
      :accent="AWARD_STYLE.marathon.accent"
      :detail="t('rewind.awards.endurance.marathonDetail')"
      :is-mine="won.has('marathon')"
    />

    <div class="flex flex-col gap-2">
      <AwardRow
        v-if="season.endurance.topFiveKing"
        :label="t('rewind.awards.endurance.topFive')"
        :player-name="season.endurance.topFiveKing.player.displayName"
        :value="season.endurance.topFiveKing.value"
        :icon="AWARD_STYLE.topFiveKing.icon"
        :accent="AWARD_STYLE.topFiveKing.accent"
        :detail="t('rewind.awards.endurance.residencyDetail')"
        :is-mine="won.has('topFiveKing')"
      />
      <AwardRow
        v-if="season.endurance.topThreeKing"
        :label="t('rewind.awards.endurance.topThree')"
        :player-name="season.endurance.topThreeKing.player.displayName"
        :value="season.endurance.topThreeKing.value"
        :icon="AWARD_STYLE.topThreeKing.icon"
        :accent="AWARD_STYLE.topThreeKing.accent"
        :detail="t('rewind.awards.endurance.residencyDetail')"
        :is-mine="won.has('topThreeKing')"
      />
      <AwardRow
        v-if="season.endurance.topOneKing"
        :label="t('rewind.awards.endurance.topOne')"
        :player-name="season.endurance.topOneKing.player.displayName"
        :value="season.endurance.topOneKing.value"
        :icon="AWARD_STYLE.topOneKing.icon"
        :accent="AWARD_STYLE.topOneKing.accent"
        :detail="t('rewind.awards.endurance.residencyDetail')"
        :is-mine="won.has('topOneKing')"
      />
      <AwardRow
        v-if="season.endurance.longestStreak"
        :label="t('rewind.awards.endurance.longestStreak')"
        :player-name="season.endurance.longestStreak.player.displayName"
        :value="season.endurance.longestStreak.value"
        :icon="AWARD_STYLE.longestStreak.icon"
        :accent="AWARD_STYLE.longestStreak.accent"
        :detail="t('rewind.awards.endurance.streakDetail')"
        :is-mine="won.has('longestStreak')"
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
