<template>
  <MatchList
    :tournament-id="store.tournamentId"
    :bracket-mode="store.tournament!.mode === 'bracket'"
    :players="store.participants.map(p => ({ id: p.userId, displayName: p.user.displayName }))"
  />
</template>

<script setup lang="ts">
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import MatchList from '@/components/MatchList.vue'

const store = useTournamentDetailStore()
</script>
