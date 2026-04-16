<template>
  <TeamManagementPanel
    :tournament-id="store.tournamentId"
    :current-user-id="store.appUser?.id"
    :is-participant="store.isParticipant"
    :can-manage="store.canManageTournament"
    :tournament-status="store.tournament!.status"
  />
</template>

<script setup lang="ts">
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import TeamManagementPanel from '@/components/tournament/TeamManagementPanel.vue'

const store = useTournamentDetailStore()
</script>
