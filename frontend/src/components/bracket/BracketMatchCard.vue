<template>
  <div
    class="bracket-match-card p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600"
    :class="{
      'opacity-60': isBye,
      'ring-2 ring-primary-500': isHighlighted,
    }"
    @click="handleClick"
  >
    <!-- Match Header -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ matchLabel }}
      </span>
      <Tag :value="statusLabel" :severity="statusSeverity" class="text-xs" />
    </div>

    <!-- Team A -->
    <div
      class="flex items-center justify-between py-1.5 px-2 rounded"
      :class="{
        'bg-green-50 dark:bg-green-900/20': match.winnerSide === 'A',
      }"
    >
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <i v-if="match.winnerSide === 'A'" class="fa fa-trophy text-yellow-500 text-xs"></i>
        <span
          class="text-sm font-medium truncate"
          :class="{
            'text-green-700 dark:text-green-400 font-bold': match.winnerSide === 'A',
            'text-gray-900 dark:text-white': match.winnerSide !== 'A',
            'text-gray-400 dark:text-gray-500 italic': !match.teamAId,
          }"
        >
          {{ teamALabel }}
        </span>
      </div>
      <span
        v-if="hasScore"
        class="text-sm font-semibold ml-2"
        :class="{
          'text-green-700 dark:text-green-400': match.winnerSide === 'A',
          'text-gray-700 dark:text-gray-300': match.winnerSide !== 'A',
        }"
      >
        {{ match.scoreA }}
      </span>
    </div>

    <!-- Separator -->
    <div class="text-center text-xs text-gray-400 py-0.5">vs</div>

    <!-- Team B -->
    <div
      class="flex items-center justify-between py-1.5 px-2 rounded"
      :class="{
        'bg-green-50 dark:bg-green-900/20': match.winnerSide === 'B',
      }"
    >
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <i v-if="match.winnerSide === 'B'" class="fa fa-trophy text-yellow-500 text-xs"></i>
        <span
          class="text-sm font-medium truncate"
          :class="{
            'text-green-700 dark:text-green-400 font-bold': match.winnerSide === 'B',
            'text-gray-900 dark:text-white': match.winnerSide !== 'B',
            'text-gray-400 dark:text-gray-500 italic': !match.teamBId,
          }"
        >
          {{ teamBLabel }}
        </span>
      </div>
      <span
        v-if="hasScore"
        class="text-sm font-semibold ml-2"
        :class="{
          'text-green-700 dark:text-green-400': match.winnerSide === 'B',
          'text-gray-700 dark:text-gray-300': match.winnerSide !== 'B',
        }"
      >
        {{ match.scoreB }}
      </span>
    </div>

    <!-- Next match info -->
    <div v-if="showNextMatch && match.nextMatchWinId" class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
      <span class="text-xs text-gray-400">
        <i class="fa fa-arrow-right mr-1"></i>
        Gagnant → Match suivant
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ClientMatchModel } from '@skill-arena/shared/types/index'

interface Props {
  match: ClientMatchModel
  showNextMatch?: boolean
  isHighlighted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showNextMatch: false,
  isHighlighted: false,
})

const router = useRouter()

const matchLabel = computed(() => {
  const round = props.match.round ?? 1
  const seq = props.match.sequence ?? 0
  const bracketPrefix = props.match.bracketType === 'loser' ? 'LB' : props.match.bracketType === 'grand_final' ? 'GF' : 'WB'
  return `${bracketPrefix} R${round}-M${seq + 1}`
})

const isBye = computed(() => {
  return (!props.match.teamAId && props.match.teamBId) || (props.match.teamAId && !props.match.teamBId)
})

const hasScore = computed(() => {
  return props.match.status !== 'scheduled'
})

const teamALabel = computed(() => {
  if (!props.match.teamAId) return 'BYE'
  if (props.match.teamA?.name) return props.match.teamA.name
  if (props.match.teamA?.participants?.length) {
    return props.match.teamA.participants.map((p) => p.user?.displayName || 'Joueur').join(', ')
  }
  return 'Équipe A'
})

const teamBLabel = computed(() => {
  if (!props.match.teamBId) return 'BYE'
  if (props.match.teamB?.name) return props.match.teamB.name
  if (props.match.teamB?.participants?.length) {
    return props.match.teamB.participants.map((p) => p.user?.displayName || 'Joueur').join(', ')
  }
  return 'Équipe B'
})

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    scheduled: 'À jouer',
    reported: 'Saisi',
    pending_confirmation: 'En attente',
    confirmed: 'Confirmé',
    disputed: 'Contesté',
    finalized: 'Terminé',
    cancelled: 'Annulé',
  }
  return labels[props.match.status] || props.match.status
})

const statusSeverity = computed<'success' | 'info' | 'warn' | 'danger' | 'secondary'>(() => {
  const severities: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
    scheduled: 'info',
    reported: 'warn',
    pending_confirmation: 'warn',
    confirmed: 'success',
    disputed: 'danger',
    finalized: 'success',
    cancelled: 'secondary',
  }
  return severities[props.match.status] || 'info'
})

function handleClick() {
  router.push(`/matches/${props.match.id}`)
}
</script>

<style scoped>
.bracket-match-card {
  min-width: 200px;
  max-width: 280px;
}
</style>
