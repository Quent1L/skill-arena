<template>
  <div
    class="flex flex-col h-full bg-gray-50 dark:bg-gray-900"
    style="min-height: calc(100vh - 7rem)"
  >
    <!-- Mobile Header -->
    <div
      class="top-0 left-0 right-0 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 shadow-sm"
    >
      <Button
        icon="fa fa-arrow-left"
        text
        rounded
        @click="router.push('/')"
        class="mr-2 !w-10 !h-10 text-gray-700 dark:text-gray-200"
      />
      <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
        {{ tabTitles[activeTab] }}
      </h1>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto pb-24">
      <!-- Tab: Classement -->
      <div v-show="activeTab === 'leaderboard'" class="p-4">
        <RankedLeaderboard
          :players="leaderboard"
          :boundaries="boundaries"
          :placement-matches="placementMatches"
          :loading="loading"
        />
      </div>

      <!-- Tab: Mon profil (auth only) -->
      <div v-if="isAuthenticated && appUser" v-show="activeTab === 'profile'" class="p-4">
        <div v-if="playerMmr">
          <PlayerMmrProfile
            :mmr="playerMmr"
            :boundaries="boundaries"
            :placement-matches="placementMatches"
          />
        </div>
        <div v-else class="text-center py-12 text-gray-500">
          <i class="fa fa-user-slash text-4xl mb-4 block"></i>
          <p>Vous n'avez pas encore de MMR pour cette saison.</p>
          <p class="text-sm mt-2">Déclarez votre premier match pour rejoindre le classement !</p>
        </div>
      </div>

      <!-- Tab: Historique -->
      <div v-show="activeTab === 'history'" class="p-4">
        <div v-if="isAuthenticated && appUser">
          <RankedMatchHistory :history="playerHistory" :loading="loading" />
        </div>
        <div v-else class="text-center py-12 text-gray-500">
          Connectez-vous pour voir votre historique MMR.
        </div>
      </div>

      <!-- Tab: Matchs -->
      <div v-show="activeTab === 'matches'" class="h-full p-2">
        <MatchList :tournament-id="seasonId" :bracket-mode="false" />
      </div>
    </div>

    <!-- Speed Dial for Create Match -->
    <div v-if="activeTab === 'matches' && canCreateMatch">
      <SpeedDial
        @click="$emit('create-match')"
        :radius="120"
        style="position: fixed; bottom: 5rem; right: 1rem"
        showIcon="fa fa-plus"
        hide-icon="fa fa-plus"
        buttonClass="p-button-rounded p-button-primary shadow-lg !w-14 !h-14"
      />
    </div>

    <!-- Bottom Navigation -->
    <div
      class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around items-center z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
    >
      <button
        @click="activeTab = 'leaderboard'"
        class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
        :class="
          activeTab === 'leaderboard'
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        "
      >
        <div
          class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
          :class="activeTab === 'leaderboard' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"
        ></div>
        <i
          class="fas fa-trophy text-xl mb-1 transition-transform duration-200"
          :class="activeTab === 'leaderboard' ? 'scale-110' : 'group-hover:scale-105'"
        ></i>
        <span class="text-xs font-medium">Classement</span>
      </button>

      <button
        v-if="isAuthenticated && appUser"
        @click="activeTab = 'profile'"
        class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
        :class="
          activeTab === 'profile'
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        "
      >
        <div
          class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
          :class="activeTab === 'profile' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"
        ></div>
        <i
          class="fas fa-user text-xl mb-1 transition-transform duration-200"
          :class="activeTab === 'profile' ? 'scale-110' : 'group-hover:scale-105'"
        ></i>
        <span class="text-xs font-medium">Mon profil</span>
      </button>

      <button
        @click="activeTab = 'history'"
        class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
        :class="
          activeTab === 'history'
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        "
      >
        <div
          class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
          :class="activeTab === 'history' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"
        ></div>
        <i
          class="fas fa-clock text-xl mb-1 transition-transform duration-200"
          :class="activeTab === 'history' ? 'scale-110' : 'group-hover:scale-105'"
        ></i>
        <span class="text-xs font-medium">Historique</span>
      </button>

      <button
        @click="activeTab = 'matches'"
        class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
        :class="
          activeTab === 'matches'
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        "
      >
        <div
          class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
          :class="activeTab === 'matches' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"
        ></div>
        <i
          class="fas fa-gamepad text-xl mb-1 transition-transform duration-200"
          :class="activeTab === 'matches' ? 'scale-110' : 'group-hover:scale-105'"
        ></i>
        <span class="text-xs font-medium">Matchs</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { ClientPlayerMmr, ClientMmrHistoryEntry, RankBoundaries } from '@skill-arena/shared/types/index'
import type { RankedSeason } from '@/composables/ranked/ranked.api'
import MatchList from '@/components/MatchList.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import RankedMatchHistory from '@/components/ranked/RankedMatchHistory.vue'

const props = defineProps<{
  seasonId: string
  currentSeason: RankedSeason
  leaderboard: ClientPlayerMmr[]
  boundaries: RankBoundaries | null
  playerMmr: ClientPlayerMmr | null
  playerHistory: ClientMmrHistoryEntry[]
  loading: boolean
  isAuthenticated: boolean
  appUser: { id: string } | null
  canCreateMatch: boolean
  canManage: boolean
  placementMatches: number
}>()

const emit = defineEmits<{
  'create-match': []
  'edit': []
  'view-rules': []
  'tab-change': [tab: string]
}>()

const router = useRouter()

const activeTab = ref('leaderboard')

watch(activeTab, (tab) => {
  emit('tab-change', tab)
})

const tabTitles: Record<string, string> = {
  leaderboard: 'Classement',
  profile: 'Mon profil',
  history: 'Historique',
  matches: 'Matchs',
}
</script>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(4rem + env(safe-area-inset-bottom));
}
</style>
