<template>
  <div class="player-mmr-profile">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <!-- MMR actuel -->
      <Card>
        <template #content>
          <div class="text-center">
            <div class="text-3xl font-bold text-blue-600">{{ mmr.currentMmr }}</div>
            <div class="text-sm text-gray-500 mt-1">MMR</div>
            <div v-if="mmrDelta !== null" class="text-sm mt-1" :class="mmrDeltaClass">
              {{ mmrDelta > 0 ? '+' : '' }}{{ mmrDelta }} depuis le début
            </div>
          </div>
        </template>
      </Card>

      <!-- Rang -->
      <Card>
        <template #content>
          <div class="text-center">
            <Tag :severity="tierSeverity(rank)" :value="tierLabel(rank)" class="text-lg" />
            <div class="text-sm text-gray-500 mt-2">Rang</div>
          </div>
        </template>
      </Card>

      <!-- W/L -->
      <Card>
        <template #content>
          <div class="text-center">
            <div class="text-2xl font-bold">
              <span class="text-green-600">{{ mmr.wins }}</span>
              <span class="text-gray-400 mx-1">/</span>
              <span class="text-red-500">{{ mmr.losses }}</span>
            </div>
            <div class="text-sm text-gray-500 mt-1">V / D</div>
            <div class="text-xs text-gray-400 mt-1">{{ winrate }}% winrate</div>
          </div>
        </template>
      </Card>

      <!-- Streak -->
      <Card>
        <template #content>
          <div class="text-center">
            <div class="text-2xl font-bold text-orange-500">
              {{ mmr.winStreak > 0 ? `🔥 ${mmr.winStreak}` : '—' }}
            </div>
            <div class="text-sm text-gray-500 mt-1">Streak actuel</div>
            <div class="text-xs text-gray-400 mt-1">
              Max: {{ mmr.maxWinStreak }}
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Statut de placement -->
    <div v-if="isInPlacement" class="mb-4">
      <Message severity="info">
        Matchs de placement : {{ mmr.matchesPlayed }} / {{ placementMatches }} complétés
      </Message>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClientPlayerMmr, RankBoundaries, RankTier } from '@skill-arena/shared/types/index'

const props = defineProps<{
  mmr: ClientPlayerMmr
  boundaries: RankBoundaries | null | undefined
  placementMatches: number
  initialMmr?: number
}>()

const rank = computed((): RankTier => {
  const b = props.boundaries
  const mmr = props.mmr.currentMmr
  if (!b) return 'legend'
  if (mmr > b.challengerMax) return 'challenger'
  if (mmr > b.masterMax) return 'master'
  if (mmr > b.strategistMax) return 'strategist'
  return 'legend'
})

const mmrDelta = computed(() => {
  if (props.initialMmr === undefined) return null
  return props.mmr.currentMmr - props.initialMmr
})

const mmrDeltaClass = computed(() => {
  if (mmrDelta.value === null) return ''
  return mmrDelta.value >= 0 ? 'text-green-600' : 'text-red-500'
})

const winrate = computed(() => {
  const total = props.mmr.wins + props.mmr.losses
  if (total === 0) return 0
  return Math.round((props.mmr.wins / total) * 100)
})

const isInPlacement = computed(() => props.mmr.matchesPlayed < props.placementMatches)

function tierLabel(tier: RankTier) {
  const labels: Record<RankTier, string> = {
    challenger: 'Challenger',
    master: 'Master',
    strategist: 'Stratège',
    legend: 'Légende',
  }
  return labels[tier] ?? tier
}

function tierSeverity(tier: RankTier) {
  const severities: Record<RankTier, string> = {
    challenger: 'danger',
    master: 'warning',
    strategist: 'info',
    legend: 'secondary',
  }
  return severities[tier] ?? 'secondary'
}
</script>
