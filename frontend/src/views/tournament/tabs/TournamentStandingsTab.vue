<template>
  <div>
    <StandingsTable
      v-if="store.tournament!.mode === 'championship'"
      :tournament-id="store.tournamentId"
      :allow-draw="store.tournament!.allowDraw"
      :score-enabled="store.tournament!.scoreEnabled ?? true"
      :team-mode="store.tournament!.teamMode"
    />
    <RankedLeaderboard
      v-else-if="store.tournament!.mode === 'ranked'"
      :players="store.rankedLeaderboard"
      :tiers="store.rankedTiers"
      :loading="store.rankedLoading"
      :current-user-id="store.appUser?.id"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'

const store = useTournamentDetailStore()

onMounted(async () => {
  if (store.tournament?.mode === 'ranked') {
    await store.ensureLeaderboard()
  }
})
</script>
