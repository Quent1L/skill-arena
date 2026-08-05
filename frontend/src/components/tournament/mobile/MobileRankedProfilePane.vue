<template>
  <div>
    <RewindEntryCard :season-id="store.tournamentId" :season-status="store.tournament?.status" />
    <PlayerMmrProfile
      v-if="store.playerMmr"
      :mmr="store.playerMmr"
      :tiers="store.rankedTiers"
      :leaderboard-rank="store.playerLeaderboardRank"
      :history="store.profileChartHistory"
      :opponent-quality="store.playerOpponentQuality"
      :recent-form="store.playerStats?.stats?.recentForm"
      :most-frequent-partners="store.playerStats?.stats?.mostFrequentPartners"
      :best-partners="store.playerStats?.stats?.bestPartners"
      :nemeses="store.playerStats?.stats?.nemeses"
      :outcome-type-stats="store.playerStats?.stats?.outcomeTypeStats"
      :season-id="store.tournamentId"
      :allow-draw="store.tournament?.allowDraw"
    />
    <div v-else-if="!store.rankedLoading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <i class="fa fa-user-slash text-4xl mb-4 block"></i>
      <p>{{ t('tournamentDetailMobile.noMmrYet') }}</p>
      <p class="text-sm mt-2">
        {{ t('tournamentDetailMobile.declareFirstMatch') }}
      </p>
    </div>
    <div v-else class="p-4 space-y-3">
      <Skeleton height="6rem" class="rounded-xl" />
      <Skeleton height="4rem" class="rounded-xl" />
      <Skeleton height="10rem" class="rounded-xl" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import RewindEntryCard from '@/components/rewind/RewindEntryCard.vue'

const { t } = useI18n()
const store = useTournamentDetailStore()
</script>
