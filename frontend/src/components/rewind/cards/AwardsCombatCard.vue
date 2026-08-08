<template>
  <RewindCardShell
    :eyebrow="t('rewind.awards.eyebrow')"
    eyebrow-class="bg-orange-500/20 text-orange-300"
    :title="t('rewind.awards.combat.title')"
    :subtitle="t('rewind.awards.combat.subtitle')"
  >
    <AwardHero
      v-if="season.combat.biggestUpset"
      :label="t('rewind.awards.combat.biggestUpset')"
      :player-name="season.combat.biggestUpset.player.displayName"
      :value="season.combat.biggestUpset.value"
      :icon="AWARD_STYLE.biggestUpset.icon"
      :accent="AWARD_STYLE.biggestUpset.accent"
      :detail="upsetDetail"
      :is-mine="won.has('biggestUpset')"
      prefix="+"
      suffix=" MMR"
    />

    <div class="flex flex-col gap-2">
      <AwardRow
        v-if="season.combat.giantKiller"
        :label="t('rewind.awards.combat.giantKiller')"
        :player-name="season.combat.giantKiller.player.displayName"
        :value="season.combat.giantKiller.value"
        :icon="AWARD_STYLE.giantKiller.icon"
        :accent="AWARD_STYLE.giantKiller.accent"
        :detail="t('rewind.awards.combat.giantKillerDetail')"
        :is-mine="won.has('giantKiller')"
      />
      <AwardRow
        v-if="season.combat.leaderHunter"
        :label="t('rewind.awards.combat.leaderHunter')"
        :player-name="season.combat.leaderHunter.player.displayName"
        :value="season.combat.leaderHunter.value"
        :icon="AWARD_STYLE.leaderHunter.icon"
        :accent="AWARD_STYLE.leaderHunter.accent"
        :detail="t('rewind.awards.combat.leaderHunterDetail')"
        :is-mine="won.has('leaderHunter')"
      />
      <AwardRow
        v-if="season.combat.rivalry"
        :label="t('rewind.awards.combat.rivalry')"
        :player-name="rivalryName"
        :value="season.combat.rivalry.matchesPlayed"
        :icon="AWARD_STYLE.rivalry.icon"
        :accent="AWARD_STYLE.rivalry.accent"
        :detail="rivalryRecord"
        :is-mine="won.has('rivalry')"
      />
      <AwardRow
        v-if="season.combat.nemesis"
        :label="t('rewind.awards.combat.nemesis')"
        :player-name="season.combat.nemesis.player.displayName"
        :value="season.combat.nemesis.value"
        :icon="AWARD_STYLE.nemesis.icon"
        :accent="AWARD_STYLE.nemesis.accent"
        :detail="t('rewind.awards.combat.nemesisDetail')"
        :is-mine="won.has('nemesis')"
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
import { formatMatchup } from '@/composables/ranked/rewind.service'

const props = withDefaults(
  defineProps<{ season: SeasonRewindPayload; awardsWon?: RewindAwardKey[] }>(),
  { awardsWon: () => [] },
)

const { t } = useI18n()
const won = computed(() => new Set(props.awardsWon))

const upsetDetail = computed(() => {
  const upset = props.season.combat.biggestUpset
  if (!upset?.opponent) return undefined
  return t('rewind.awards.combat.biggestUpsetDetail', {
    // The gap is measured between side averages, so the format is part of it.
    format: upset.format ? formatMatchup(upset.format) : '1v1',
    opponent: upset.opponent.displayName,
  })
})

const rivalryName = computed(() => {
  const rivalry = props.season.combat.rivalry
  if (!rivalry) return ''
  return `${rivalry.players[0].displayName} vs ${rivalry.players[1].displayName}`
})

const rivalryRecord = computed(() => {
  const rivalry = props.season.combat.rivalry
  if (!rivalry) return undefined
  return `${rivalry.wins} - ${rivalry.losses}`
})
</script>
