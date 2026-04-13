<template>
  <BracketView :tournament-id="store.tournamentId" :tournament="store.tournament!" />
</template>

<script setup lang="ts">
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import BracketView from '@/components/bracket/BracketView.vue'

const store = useTournamentDetailStore()
</script>
