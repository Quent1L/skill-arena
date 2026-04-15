<template>
  <div class="space-y-6">
    <div
      v-if="store.tournament!.description"
      class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 tournament-description text-gray-700 dark:text-gray-300"
      v-html="store.tournament!.description"
    />
    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div class="flex items-center gap-2 mb-4 text-base font-semibold text-gray-900 dark:text-white">
        Participants
        <Badge :value="store.participantCount" severity="info" size="small" />
      </div>
      <TournamentParticipantsList
        :participants="store.participants"
        :loading="store.loadingParticipants"
        :tournament-id="store.tournamentId"
        @participant-added="store.reloadParticipants()"
      />
    </div>
    <TeamManagementPanel
      v-if="store.tournament!.teamMode === 'static'"
      :tournament-id="store.tournamentId"
      :current-user-id="store.appUser?.id"
      :is-participant="store.isParticipant"
      :can-manage="store.canManageTournament"
      :tournament-status="store.tournament!.status"
    />
  </div>
</template>

<script setup lang="ts">
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import TournamentParticipantsList from '@/components/tournament/TournamentParticipantsList.vue'
import TeamManagementPanel from '@/components/tournament/TeamManagementPanel.vue'

const store = useTournamentDetailStore()
</script>

<style scoped>
:deep(.tournament-description h2) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
:deep(.tournament-description h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
:deep(.tournament-description ul) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
:deep(.tournament-description ol) {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
:deep(.tournament-description p) {
  margin: 0.5rem 0;
}
:deep(.tournament-description strong) {
  font-weight: 700;
}
:deep(.tournament-description em) {
  font-style: italic;
}
:deep(.tournament-description u) {
  text-decoration: underline;
}
:deep(.tournament-description a) {
  color: rgb(59 130 246);
  text-decoration: underline;
}
</style>
