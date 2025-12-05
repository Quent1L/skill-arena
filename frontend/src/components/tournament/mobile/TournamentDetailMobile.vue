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
    <div class="flex-1 overflow-y-auto pb-20">
      <!-- Tab 1: Detail & Participants -->
      <div v-show="activeTab === 'detail'" class="space-y-4 p-4">
        <TournamentHeader
          :name="tournament.name"
          :description="tournament.description"
          :status="tournament.status"
          :mode="tournament.mode"
          :is-authenticated="isAuthenticated"
          :is-participant="isParticipant"
          :can-join="canJoin"
          :can-leave="canLeave"
          :can-create-match="false"
          :can-manage="canManage"
          :joining="joining"
          :leaving="leaving"
          @join="$emit('join')"
          @leave="$emit('leave')"
          @create-match="$emit('create-match')"
          @edit="$emit('edit')"
        />

        <TournamentInfoGrid
          :mode="tournament.mode"
          :team-mode="tournament.teamMode"
          :min-team-size="tournament.minTeamSize"
          :max-team-size="tournament.maxTeamSize"
          :participant-count="participantCount"
          :start-date="tournament.startDate"
          :end-date="tournament.endDate"
          :duration="tournamentDuration"
          :point-per-victory="tournament.pointPerVictory"
          :point-per-draw="tournament.pointPerDraw"
          :point-per-loss="tournament.pointPerLoss"
          :allow-draw="tournament.allowDraw"
        />

        <div class="mt-4">
          <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Participants</h3>
          <TournamentParticipantsList :participants="participants" :loading="loadingParticipants" />
        </div>
      </div>

      <!-- Tab 2: Standings -->
      <div v-show="activeTab === 'standings'" class="h-full p-2">
        <StandingsTable :tournament-id="tournamentId" :allow-draw="tournament.allowDraw" />
      </div>

      <!-- Tab 3: Matches -->
      <div v-show="activeTab === 'matches'" class="h-full p-2">
        <MatchList :tournament-id="tournamentId" />
      </div>

      <!-- Tab 4: Bracket (only for bracket mode) -->
      <div v-show="activeTab === 'bracket'" class="h-full p-2">
        <BracketView
          :tournament-id="tournamentId"
          :can-manage="canManage"
        />
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
      class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around items-center h-16 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
    >
      <button
        @click="activeTab = 'detail'"
        class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
        :class="
          activeTab === 'detail'
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        "
      >
        <div
          class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
          :class="activeTab === 'detail' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"
        ></div>
        <i
          class="fas fa-info-circle text-xl mb-1 transition-transform duration-200"
          :class="activeTab === 'detail' ? 'scale-110' : 'group-hover:scale-105'"
        ></i>
        <span class="text-xs font-medium">Détail</span>
      </button>

      <button
        @click="activeTab = 'standings'"
        class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
        :class="
          activeTab === 'standings'
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        "
      >
        <div
          class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
          :class="
            activeTab === 'standings' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
          "
        ></div>
        <i
          class="fas fa-trophy text-xl mb-1 transition-transform duration-200"
          :class="activeTab === 'standings' ? 'scale-110' : 'group-hover:scale-105'"
        ></i>
        <span class="text-xs font-medium">Classement</span>
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

      <!-- Bracket tab (only for bracket mode) -->
      <button
        v-if="isBracketMode"
        @click="activeTab = 'bracket'"
        class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
        :class="
          activeTab === 'bracket'
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        "
      >
        <div
          class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
          :class="activeTab === 'bracket' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"
        ></div>
        <i
          class="fas fa-sitemap text-xl mb-1 transition-transform duration-200"
          :class="activeTab === 'bracket' ? 'scale-110' : 'group-hover:scale-105'"
        ></i>
        <span class="text-xs font-medium">Bracket</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ClientBaseTournament, ParticipantListItem } from '@skill-arena/shared/types/index'
import MatchList from '@/components/MatchList.vue'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import TournamentInfoGrid from '@/components/tournament/TournamentInfoGrid.vue'
import TournamentParticipantsList from '@/components/tournament/TournamentParticipantsList.vue'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import BracketView from '@/components/bracket/BracketView.vue'

const router = useRouter()

defineEmits<{
  (e: 'join'): void
  (e: 'leave'): void
  (e: 'create-match'): void
  (e: 'edit'): void
}>()

const props = defineProps<{
  tournament: ClientBaseTournament
  participants: ParticipantListItem[]
  participantCount: number
  loadingParticipants: boolean
  isAuthenticated: boolean
  isParticipant: boolean
  canJoin: boolean
  canLeave: boolean
  canCreateMatch: boolean
  canManage: boolean
  joining: boolean
  leaving: boolean
  tournamentId: string
  tournamentDuration: string
}>()

const isBracketMode = computed(() => props.tournament?.mode === 'bracket')

const activeTab = ref('detail')

const tabTitles: Record<string, string> = {
  detail: 'Détail du tournoi',
  standings: 'Classement',
  matches: 'Matchs',
  bracket: 'Bracket',
}
</script>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
