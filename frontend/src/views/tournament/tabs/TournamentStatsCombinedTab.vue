<template>
  <div v-if="isRankedAndAuth" class="flex gap-6">
    <SubTabSidebar :options="subTabs" :model-value="sub" @update:model-value="setSub" />

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div v-if="sub === 'profile'">
        <RewindEntryCard
          :season-id="store.tournamentId"
          :season-status="store.tournament?.status"
        />
        <PlayerMmrProfile
          v-if="store.playerMmr"
          :mmr="store.playerMmr"
          :tiers="store.rankedTiers"
          :leaderboard-rank="store.playerLeaderboardRank"
          :placement-matches="store.rankedPlacementMatches"
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
        <div v-else-if="store.rankedLoading" class="flex justify-center py-12">
          <ProgressSpinner />
        </div>
        <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
          <i class="fa fa-user-slash text-4xl mb-4 block"></i>
          <p>{{ t('tournamentStatsCombinedTab.noMmr') }}</p>
          <p class="text-sm mt-2">{{ t('tournamentStatsCombinedTab.noMmrHint') }}</p>
        </div>
      </div>
      <TournamentStatsTab v-else />
    </div>
  </div>

  <TournamentStatsTab v-else />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import { useSubTabs } from '@/composables/ui/useSubTabs'
import SubTabSidebar from '@/components/ui/SubTabSidebar.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import RewindEntryCard from '@/components/rewind/RewindEntryCard.vue'
import TournamentStatsTab from './TournamentStatsTab.vue'
import ProgressSpinner from 'primevue/progressspinner'

const store = useTournamentDetailStore()
const { t } = useI18n()

// Same values and same query param as the mobile switcher, so a link opened on the
// other form factor lands on the same pane.
const subTabs = computed(() => [
  { value: 'profile' as const, label: t('tournamentStatsCombinedTab.nav.myProfile') },
  { value: 'global' as const, label: t('tournamentStatsCombinedTab.nav.global') },
])

const { active: sub, setActive: setSub } = useSubTabs({ options: subTabs, queryKey: 'statsSub' })

const isRankedAndAuth = computed(
  () => store.tournament?.mode === 'ranked' && store.isAuthenticated && !!store.appUser,
)

onMounted(async () => {
  if (isRankedAndAuth.value) await store.ensurePlayerProfile()
})
</script>
