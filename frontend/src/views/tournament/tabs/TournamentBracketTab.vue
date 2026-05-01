<template>
  <div>
    <BracketView
      :tournament-id="store.tournamentId"
      :tournament="store.tournament!"
      style="--bracket-sticky-top: 0rem"
    />
  </div>
</template>

<script setup lang="ts">
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import BracketView from '@/components/bracket/BracketView.vue'

const store = useTournamentDetailStore()
</script>
