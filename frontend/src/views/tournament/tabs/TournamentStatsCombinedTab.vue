<template>
  <div v-if="isRankedAndAuth" class="flex gap-6">
    <!-- Sidebar -->
    <nav class="w-48 shrink-0 flex flex-col gap-1">
      <button
        class="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        :class="
          sub === 'profile'
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        "
        @click="sub = 'profile'"
      >
        {{ t('tournamentStatsCombinedTab.nav.myProfile') }}
      </button>
      <button
        class="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        :class="
          sub === 'global'
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        "
        @click="sub = 'global'"
      >
        {{ t('tournamentStatsCombinedTab.nav.global') }}
      </button>
    </nav>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div v-if="sub === 'profile'">
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import TournamentStatsTab from './TournamentStatsTab.vue'
import ProgressSpinner from 'primevue/progressspinner'

const store = useTournamentDetailStore()
const sub = ref<'profile' | 'global'>('profile')
const { t } = useI18n()

const isRankedAndAuth = computed(
  () => store.tournament?.mode === 'ranked' && store.isAuthenticated && !!store.appUser,
)

onMounted(async () => {
  if (isRankedAndAuth.value) await store.ensurePlayerProfile()
})
</script>
