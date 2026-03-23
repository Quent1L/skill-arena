<template>
  <div v-if="currentSeason">
    <!-- Mobile -->
    <RankedSeasonDetailMobile
      v-if="isMobile"
      :season-id="seasonId"
      :current-season="currentSeason"
      :leaderboard="leaderboard"
      :tiers="tiers"
      :player-mmr="playerMmr"
      :player-history="playerHistory"
      :player-history-has-more="playerHistoryHasMore"
      :on-load-more-history="loadMoreHistory"
      :allow-draw="currentSeason.allowDraw ?? false"
      :total-matches="playerMmr?.matchesPlayed ?? 0"
      :loading="loading"
      :is-authenticated="isAuthenticated"
      :app-user="appUser"
      :can-create-match="currentSeason.status === 'ongoing' && isAuthenticated"
      :can-manage="isAdmin"
      :placement-matches="currentSeason.rankedConfig?.placementMatches ?? 5"
      :leaderboard-rank="playerLeaderboardRank"
      :profile-chart-history="profileChartHistory"
      @create-match="goToCreateMatch"
      @edit="goToEdit"
      @view-rules="goToRules"
      @tab-change="onTabChange"
    />

    <!-- Desktop -->
    <div v-else class="ranked-season-detail p-4">
      <TournamentHeader
        :name="currentSeason.name"
        :description="currentSeason.description ?? undefined"
        :status="currentSeason.status as TournamentStatus"
        :mode="'ranked'"
        :is-authenticated="isAuthenticated"
        :is-participant="false"
        :can-join="false"
        :can-leave="false"
        :can-create-match="currentSeason.status === 'ongoing' && isAuthenticated"
        :can-manage="isAdmin"
        :rules-id="currentSeason.rulesId"
        :show-recalculate="false"
        @create-match="goToCreateMatch"
        @edit="goToEdit"
        @view-rules="goToRules"
      />

      <Message v-if="error" severity="error" :closable="true" class="my-4">
        {{ error }}
      </Message>

      <!-- Sidebar + Content -->
      <div class="flex gap-4 mt-6">
        <!-- Sidebar -->
        <nav class="w-48 shrink-0">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              v-for="item in sidebarItems"
              :key="item.value"
              @click="activeTab = item.value"
              class="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors duration-150 relative"
              :class="
                activeTab === item.value
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
              "
            >
              <div
                class="absolute left-0 top-0 bottom-0 w-0.5 transition-colors duration-150"
                :class="activeTab === item.value ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"
              ></div>
              <i :class="[item.icon, 'w-4 text-center']"></i>
              {{ item.label }}
            </button>
          </div>
        </nav>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <!-- Classement -->
          <div v-show="activeTab === 'leaderboard'">
            <RankedLeaderboard
              :players="leaderboard"
              :tiers="tiers"
              :placement-matches="currentSeason.rankedConfig?.placementMatches ?? 5"
              :loading="loading"
              :current-user-id="appUser?.id"
            />
          </div>

          <!-- Mon profil -->
          <div v-if="isAuthenticated && appUser" v-show="activeTab === 'profile'">
            <div v-if="playerMmr">
              <PlayerMmrProfile
                :mmr="playerMmr"
                :tiers="tiers"
                :placement-matches="currentSeason.rankedConfig?.placementMatches ?? 5"
                :leaderboard-rank="playerLeaderboardRank"
                :history="profileChartHistory"
              />
            </div>
            <div v-else class="text-center py-12 text-gray-500">
              <i class="fa fa-user-slash text-4xl mb-4 block"></i>
              <p>Vous n'avez pas encore de MMR pour cette saison.</p>
              <p class="text-sm mt-2">
                Déclarez votre premier match pour rejoindre le classement !
              </p>
            </div>
          </div>

          <!-- Historique MMR -->
          <div v-show="activeTab === 'history'">
            <div v-if="isAuthenticated && appUser">
              <RankedMatchHistory
                :history="playerHistory"
                :loading="loading"
                :has-more="playerHistoryHasMore"
                :allow-draw="currentSeason.allowDraw ?? false"
                :total-matches="playerMmr?.matchesPlayed ?? 0"
                :on-load-more="loadMoreHistory"
              />
            </div>
            <div v-else class="text-center py-12 text-gray-500">
              Connectez-vous pour voir votre historique MMR.
            </div>
          </div>

          <!-- Matchs -->
          <div v-show="activeTab === 'matches'">
            <MatchList :tournament-id="seasonId" :bracket-mode="false" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="loading" class="flex justify-center items-center h-64">
    <ProgressSpinner />
  </div>

  <div v-else class="text-center py-12 text-gray-500">Saison introuvable.</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRankedService } from '@/composables/ranked/ranked.service'
import { rankedApi } from '@/composables/ranked/ranked.api'
import { useAuth } from '@/composables/useAuth'
import { useViewport } from '@/composables/useViewport'
import type { TournamentStatus } from '@skill-arena/shared'
import type { ClientMmrHistoryEntry } from '@skill-arena/shared/types/index'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import MatchList from '@/components/MatchList.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import RankedMatchHistory from '@/components/ranked/RankedMatchHistory.vue'
import RankedSeasonDetailMobile from '@/components/ranked/mobile/RankedSeasonDetailMobile.vue'

const router = useRouter()
const route = useRoute()
const { isAuthenticated, appUser, isAdmin } = useAuth()
const { isMobile } = useViewport()

const {
  currentSeason,
  leaderboard,
  tiers,
  playerMmr,
  playerHistory,
  playerHistoryHasMore,
  loading,
  error,
  loadSeasonById,
  loadLeaderboard,
  loadPlayerMmr,
  loadPlayerHistory,
  loadMoreHistory,
} = useRankedService()

const activeTab = ref('leaderboard')
const seasonId = computed(() => route.params.id as string)
const profileChartHistory = ref<ClientMmrHistoryEntry[]>([])

const playerLeaderboardRank = computed(() => {
  if (!appUser.value || leaderboard.value.length === 0) return undefined
  const idx = leaderboard.value.findIndex((p) => p.player?.id === appUser.value?.id)
  return idx >= 0 ? idx + 1 : undefined
})

const sidebarItems = computed(() => [
  { value: 'leaderboard', label: 'Classement', icon: 'fas fa-trophy' },
  ...(isAuthenticated.value && appUser.value
    ? [{ value: 'profile', label: 'Mon profil', icon: 'fas fa-user' }]
    : []),
  { value: 'history', label: 'Historique', icon: 'fas fa-clock' },
  { value: 'matches', label: 'Matchs', icon: 'fas fa-gamepad' },
])

function goToCreateMatch() {
  router.push(`/tournaments/${seasonId.value}/create-match`)
}

function goToEdit() {
  router.push(`/admin/ranked/${seasonId.value}/edit`)
}

function goToRules() {
  router.push(`/tournaments/${seasonId.value}/rules`)
}

async function onTabChange(tab: string) {
  if (tab === 'profile' && appUser.value) {
    await loadPlayerMmr(seasonId.value, appUser.value.id)
    profileChartHistory.value = await rankedApi.getPlayerHistory(seasonId.value, appUser.value.id, { limit: 200 })
  }
  if (tab === 'history' && appUser.value) {
    await loadPlayerHistory(seasonId.value, appUser.value.id)
  }
}

watch(activeTab, onTabChange)

onMounted(async () => {
  await loadSeasonById(seasonId.value)
  await loadLeaderboard(seasonId.value)
})
</script>

<style scoped>
.ranked-season-detail {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
