<template>
  <div class="bracket-round">
    <!-- Round Header -->
    <div class="text-center mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ roundLabel }}
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ matches.length }} match{{ matches.length > 1 ? 's' : '' }}
      </p>
    </div>

    <!-- Matches -->
    <div class="space-y-3">
      <BracketMatchCard
        v-for="match in matches"
        :key="match.id"
        :match="match"
        :show-next-match="showNextMatch"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClientMatchModel } from '@skill-arena/shared/types/index'
import BracketMatchCard from './BracketMatchCard.vue'

interface Props {
  roundNumber: number
  matches: ClientMatchModel[]
  roundLabel: string
  showNextMatch?: boolean
}

withDefaults(defineProps<Props>(), {
  showNextMatch: false,
})
</script>

<style scoped>
.bracket-round {
  min-width: 280px;
  padding: 0 0.5rem;
}
</style>
