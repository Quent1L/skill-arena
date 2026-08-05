<template>
  <RewindCardShell
    :eyebrow="t('rewind.awards.eyebrow')"
    eyebrow-class="bg-emerald-500/20 text-emerald-300"
    :title="t('rewind.awards.cooperation.title')"
    :subtitle="t('rewind.awards.cooperation.subtitle')"
  >
    <div
      v-if="season.cooperation.duo"
      class="flex flex-col items-center gap-3 rounded-3xl px-5 py-6"
      :class="won.has('duo') ? 'bg-amber-500/15 ring-1 ring-amber-400/50' : 'bg-white/5'"
    >
      <i
        :class="AWARD_STYLE.duo.icon"
        class="text-4xl"
        :style="{ color: AWARD_STYLE.duo.accent }"
      />
      <span class="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {{ t('rewind.awards.cooperation.duo') }}
      </span>

      <div class="flex items-center gap-3 text-lg font-bold">
        <span>{{ season.cooperation.duo.players[0].displayName }}</span>
        <i class="fa fa-plus text-xs text-gray-500" />
        <span>{{ season.cooperation.duo.players[1].displayName }}</span>
      </div>

      <span class="text-4xl font-black tabular-nums" :style="{ color: AWARD_STYLE.duo.accent }">
        {{ season.cooperation.duo.winRate }} %
      </span>
      <span class="text-xs text-gray-400">
        {{
          t('rewind.awards.cooperation.duoDetail', {
            wins: season.cooperation.duo.wins,
            matches: season.cooperation.duo.matchesTogether,
          })
        }}
      </span>
    </div>

    <AwardRow
      v-if="season.cooperation.bestPartner"
      :label="t('rewind.awards.cooperation.bestPartner')"
      :player-name="season.cooperation.bestPartner.player.displayName"
      :value="season.cooperation.bestPartner.value"
      :icon="AWARD_STYLE.bestPartner.icon"
      :accent="AWARD_STYLE.bestPartner.accent"
      :detail="t('rewind.awards.cooperation.bestPartnerDetail')"
      :is-mine="won.has('bestPartner')"
    />
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RewindAwardKey, SeasonRewindPayload } from '@skol-arena/shared/types/index'
import RewindCardShell from '../RewindCardShell.vue'
import AwardRow from '../AwardRow.vue'
import { AWARD_STYLE } from '../award-display'

const props = withDefaults(
  defineProps<{ season: SeasonRewindPayload; awardsWon?: RewindAwardKey[] }>(),
  { awardsWon: () => [] },
)

const { t } = useI18n()
const won = computed(() => new Set(props.awardsWon))
</script>
