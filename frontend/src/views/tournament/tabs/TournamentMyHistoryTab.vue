<template>
  <PlayerMatchHistory
    :history="store.matchHistory"
    :loading="store.matchHistoryLoading"
    :has-more="store.matchHistoryHasMore"
    :on-load-more="store.loadMoreMatchHistory"
  />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import PlayerMatchHistory from '@/components/match/PlayerMatchHistory.vue'

const store = useTournamentDetailStore()

onMounted(async () => {
  await store.ensureMatchHistory()
})
</script>
