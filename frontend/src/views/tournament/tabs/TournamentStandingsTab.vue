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
      :is-recalculating="store.isLeaderboardRecalculating"
      :current-user-id="store.appUser?.id"
      :show-mode-toggle="store.tournament!.validationMode !== 'none'"
      :tournament-id="store.tournamentId"
      @load-provisional="store.loadProvisionalLeaderboard()"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'

const store = useTournamentDetailStore()

// Leaderboard WS handling (recalc flag + reload) lives in TournamentDetailView,
// which stays mounted across tab switches, so events aren't missed while this
// tab is unmounted.
onMounted(async () => {
  if (store.tournament?.mode === 'ranked') {
    await store.ensureLeaderboard()
  }
})
</script>
