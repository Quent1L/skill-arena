<template>
  <div>
    <StandingsTable
      v-if="store.tournament!.mode === 'championship'"
      :tournament-id="store.tournamentId"
      :allow-draw="store.tournament!.allowDraw"
      :score-enabled="store.tournament!.scoreEnabled ?? true"
      :team-mode="store.tournament!.teamMode"
      :show-provisional-toggle="store.tournament!.validationMode !== 'none'"
      :tournament-config="{
        pointPerVictory: store.tournament!.pointPerVictory,
        pointPerDraw: store.tournament!.pointPerDraw,
        pointPerLoss: store.tournament!.pointPerLoss,
        maxMatchesPerPlayer: store.tournament!.maxMatchesPerPlayer,
        maxTimesWithSamePartner: store.tournament!.maxTimesWithSamePartner,
        maxTimesWithSameOpponent: store.tournament!.maxTimesWithSameOpponent,
        minTeamSize: store.tournament!.minTeamSize,
        maxTeamSize: store.tournament!.maxTeamSize,
        minScore: store.tournament!.minScore,
        maxScore: store.tournament!.maxScore,
        disciplineId: store.tournament!.disciplineId,
      }"
    />
    <RankedLeaderboard
      v-else-if="store.tournament!.mode === 'ranked'"
      :players="store.rankedLeaderboard"
      :provisional-players="store.rankedProvisionalLeaderboard"
      :tiers="store.rankedTiers"
      :loading="store.rankedLoading"
      :provisional-loading="store.rankedProvisionalLoading"
      :is-recalculating="isLeaderboardRecalculating"
      :current-user-id="store.appUser?.id"
      :show-mode-toggle="store.tournament!.validationMode !== 'none'"
      :tournament-id="store.tournamentId"
      @load-provisional="store.loadProvisionalLeaderboard()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import { onWsEvent } from '@/composables/notification/notification.socket'

const store = useTournamentDetailStore()
const isLeaderboardRecalculating = ref(false)

onMounted(async () => {
  if (store.tournament?.mode === 'ranked') {
    await store.ensureLeaderboard()
  }
})

const offRecalc = onWsEvent('leaderboard_recalculating', (data) => {
  if ((data as { seasonId: string }).seasonId === store.tournamentId) {
    isLeaderboardRecalculating.value = true
  }
})

const offUpdate = onWsEvent('leaderboard_updated', (data) => {
  if ((data as { seasonId: string }).seasonId === store.tournamentId) {
    isLeaderboardRecalculating.value = false
    store.reloadLeaderboard()
  }
})

onUnmounted(() => {
  offRecalc()
  offUpdate()
})
</script>
