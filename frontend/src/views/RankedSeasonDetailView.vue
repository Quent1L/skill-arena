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
      <div class="flex gap-6 mt-6">
        <!-- Sidebar -->
        <nav class="w-64 shrink-0">
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <!-- Sidebar header -->
            <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-transparent dark:from-primary-900/20 dark:to-transparent">
              <p class="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Navigation</p>
            </div>
            <!-- Nav items -->
            <div class="py-1">
              <button
                v-for="item in sidebarItems"
                :key="item.value"
                @click="activeTab = item.value"
                class="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all duration-150 relative group"
                :class="
                  activeTab === item.value
                    ? 'bg-gradient-to-r from-primary-50 to-transparent dark:from-primary-900/20 dark:to-transparent'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                "
              >
                <div
                  class="absolute left-0 top-2 bottom-2 w-0.5 rounded-r transition-all duration-150"
                  :class="activeTab === item.value ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"
                ></div>
                <!-- Icon wrapper -->
                <div
                  class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150"
                  :class="
                    activeTab === item.value
                      ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm shadow-primary-200 dark:shadow-primary-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                  "
                >
                  <i :class="[item.icon, 'text-sm']"></i>
                </div>
                <!-- Label + description -->
                <div class="min-w-0">
                  <p
                    class="text-sm font-semibold leading-tight"
                    :class="activeTab === item.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'"
                  >{{ item.label }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{{ item.description }}</p>
                </div>
              </button>
            </div>
          </div>
        </nav>

        <!-- Content -->
        <Transition name="tab-fade" mode="out-in">
          <div :key="activeTab" class="flex-1 min-w-0">
            <!-- Classement -->
            <RankedLeaderboard
              v-if="activeTab === 'leaderboard'"
              :players="leaderboard"
              :tiers="tiers"
              :loading="loading"
              :current-user-id="appUser?.id"
            />

            <!-- Mon profil -->
            <template v-else-if="activeTab === 'profile'">
              <div v-if="isAuthenticated && appUser">
                <div v-if="playerMmr">
                  <PlayerMmrProfile
                    :mmr="playerMmr"
                    :tiers="tiers"
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
            </template>

            <!-- Historique MMR -->
            <template v-else-if="activeTab === 'history'">
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
            </template>

            <!-- Matchs -->
            <MatchList v-else-if="activeTab === 'matches'" :tournament-id="seasonId" :bracket-mode="false" />
          </div>
        </Transition>
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
  { value: 'leaderboard', label: 'Classement', icon: 'fas fa-trophy', description: 'Top joueurs de la saison' },
  ...(isAuthenticated.value && appUser.value
    ? [{ value: 'profile', label: 'Mon profil', icon: 'fas fa-user', description: 'Votre MMR & progression' }]
    : []),
  { value: 'history', label: 'Historique', icon: 'fas fa-clock', description: 'Vos matchs récents' },
  { value: 'matches', label: 'Matchs', icon: 'fas fa-gamepad', description: 'Tous les matchs' },
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

.tab-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.tab-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
