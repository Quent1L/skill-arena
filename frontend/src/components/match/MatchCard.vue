<template>
  <div
    class="group relative overflow-hidden rounded-xl bg-surface-800 border border-surface-700/10 hover:bg-surface-700 transition-all duration-300 cursor-pointer flex flex-col"
    @click="navigateToMatch(entry.id)"
  >
    <div class="px-3 pt-2.5 pb-2 relative z-10 flex flex-col flex-1">
      <!-- Top row: format badge + outcomeType + result badge + MMR -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <span class="font-label text-xs text-muted-color">{{ formatBadge }}</span>
          <span v-if="entry.outcomeType" class="font-label text-xs text-muted-color"
            >· {{ entry.outcomeType.name }}</span
          >
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span
            v-if="currentPlayerId && entry.pointsDelta != null"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border font-headline font-black tabular-nums text-sm"
            :class="mmrPillClass(entry.pointsDelta)"
          >
            <i class="fa fa-star text-xs"></i>
            {{ entry.pointsDelta > 0 ? '+' : '' }}{{ entry.pointsDelta }}
          </span>
          <span
            v-if="currentPlayerId && entry.mmrDelta != null"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border font-headline font-black tabular-nums text-sm"
            :class="mmrPillClass(entry.mmrDelta)"
          >
            <i class="fa fa-bolt text-xs"></i>
            {{ entry.mmrDelta > 0 ? '+' : '' }}{{ entry.mmrDelta }}
          </span>
          <span
            v-if="currentPlayerId"
            class="font-headline text-xs font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border"
            :class="resultBadgeClass"
          >
            {{ outcomeLabel }}
          </span>
        </div>
      </div>

      <!-- Center: left side | score | right side -->
      <div class="flex items-center gap-2 pt-3 flex-1 justify-center">
        <!-- Left side (my side when player mode, side A when neutral) -->
        <div class="flex-1 flex flex-col items-center gap-1 relative">
          <div
            v-if="entry.status !== 'cancelled' && leftSide?.isWinner"
            class="absolute -top-6 left-1/2 -translate-x-1/2"
          >
            <i class="fa fa-trophy text-yellow-500 flex-shrink-0 text-xs"></i>
          </div>
          <PlayerAvatarStack :players="leftSide?.players ?? []" size="md" />
          <div class="flex flex-col items-center gap-0.5">
            <span
              v-for="player in (leftSide?.players ?? []).slice(0, 2)"
              :key="player.id"
              class="font-label font-semibold tracking-tight truncate  text-center"
              :class="player.id === currentPlayerId ? 'text-color/80' : 'text-color/50'"
            >
              {{ player.displayName }}
            </span>
          </div>
        </div>

        <!-- Score (only when scoreEnabled and scores exist) -->
        <div
          v-if="showScore"
          class="font-headline text-2xl font-black tracking-tighter flex items-center gap-1.5 shrink-0"
          :class="scoreColorClass"
        >
          <span>{{ leftSide?.score ?? 0 }}</span>
          <span class="text-muted-color/40 text-base">-</span>
          <span>{{ rightSide?.score ?? 0 }}</span>
        </div>
        <div
          v-else
          class="font-headline text-2xl text-muted-color/40 tracking-tighter flex items-center gap-1.5 shrink-0"
        >
          {{ t('matchCard.vs') }}
        </div>

        <!-- Right side (opponent when player mode, side B when neutral) -->
        <div class="flex-1 flex flex-col items-center gap-1 relative">
          <div
            v-if="entry.status !== 'cancelled' && rightSide?.isWinner"
            class="absolute -top-6 left-1/2 -translate-x-1/2"
          >
            <i class="fa fa-trophy text-yellow-500 shrink-0 text-xs"></i>
          </div>
          <PlayerAvatarStack :players="rightSide?.players ?? []" size="md" />
          <div class="flex flex-col items-center gap-0.5">
            <span
              v-for="player in (rightSide?.players ?? []).slice(0, 2)"
              :key="player.id"
              class="font-label font-semibold  tracking-tight truncate  text-center text-color/50"
            >
              {{ player.displayName }}
            </span>
          </div>
        </div>
      </div>

      <!-- Footer: date + status + link -->
      <div class="flex justify-between items-center mt-auto pt-2 border-t border-surface-700/10">
        <div class="flex flex-wrap gap-3">
          <div class="flex items-center gap-1.5">
            <span
              class="flex h-1.5 w-1.5 rounded-full shrink-0"
              :class="statusDotClass(entry.status)"
            ></span>
            <span
              class="font-label text-[10px] uppercase font-bold tracking-tighter"
              :class="statusTextClass(entry.status)"
            >
              {{ statusLabel(entry.status) }}
            </span>
          </div>
          <span class="font-label text-xs text-muted-color uppercase">
            {{ formatDate(entry.playedAt) }}
          </span>
        </div>
        <RouterLink
          :to="`/matches/${entry.id}`"
          @click.stop
          class="text-muted-color hover:text-color transition-colors active:scale-90"
        >
          <i class="fa fa-chevron-right text-xs leading-none"></i>
        </RouterLink>
      </div>
    </div>

    <!-- Bottom accent bar -->
    <div
      class="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-500 group-hover:w-full"
      :class="accentBarClass"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { ClientMatchCard } from '@skol-arena/shared/types/index'
import PlayerAvatarStack from '@/components/PlayerAvatarStack.vue'

const props = defineProps<{
  entry: ClientMatchCard
  currentPlayerId?: string
}>()

const router = useRouter()
const { t } = useI18n()

// Determine left/right sides
// Player mode: left = my side, right = opponent side
// Neutral mode: left = position 1 (A), right = position 2 (B)
const leftSide = computed(() => {
  if (props.currentPlayerId) {
    return props.entry.sides.find((s) => s.players.some((p) => p.id === props.currentPlayerId))
  }
  return props.entry.sides.find((s) => s.position === 1)
})

const rightSide = computed(() => {
  if (props.currentPlayerId) {
    return props.entry.sides.find((s) => !s.players.some((p) => p.id === props.currentPlayerId))
  }
  return props.entry.sides.find((s) => s.position === 2)
})

const outcome = computed((): 'WIN' | 'LOSS' | 'DRAW' => {
  if (props.entry.mmrDelta != null) {
    if (props.entry.mmrDelta > 0) return 'WIN'
    if (props.entry.mmrDelta < 0) return 'LOSS'
    return 'DRAW'
  }
  if (!leftSide.value) return 'DRAW'
  if (leftSide.value.isWinner) return 'WIN'
  if (rightSide.value?.isWinner) return 'LOSS'
  return 'DRAW'
})

const outcomeLabel = computed(() => {
  if (outcome.value === 'WIN') return t('matchCard.win')
  if (outcome.value === 'LOSS') return t('matchCard.loss')
  return t('matchCard.draw')
})

const resultBadgeClass = computed(() => {
  if (outcome.value === 'WIN') return 'bg-match-win/10 border-match-win/30 text-match-win'
  if (outcome.value === 'LOSS') return 'bg-match-loss/10 border-match-loss/30 text-match-loss'
  return 'bg-surface-700/50 border-surface-600 text-muted-color'
})


const accentBarClass = computed(() => {
  if (props.currentPlayerId) {
    if (outcome.value === 'WIN') return 'bg-match-win'
    if (outcome.value === 'LOSS') return 'bg-match-loss'
    return 'bg-match-neutral'
  }
  return 'bg-primary'
})

const showScore = computed(() => {
  return (
    props.entry.tournament.scoreEnabled &&
    leftSide.value?.score != null &&
    rightSide.value?.score != null
  )
})

const scoreColorClass = computed(() => {
  if (!props.currentPlayerId) return 'text-color'
  if (outcome.value === 'WIN') return 'text-match-win'
  if (outcome.value === 'LOSS') return 'text-match-loss/80'
  return 'text-match-neutral'
})

const formatBadge = computed(() => {
  const a = leftSide.value?.players.length ?? '?'
  const b = rightSide.value?.players.length ?? '?'
  return `${a}v${b}`
})

function statusDotClass(status: string) {
  switch (status) {
    case 'finalized':
      return 'bg-match-win/80'
    case 'ongoing':
      return 'bg-yellow-400 animate-pulse'
    case 'contested':
      return 'bg-match-loss animate-pulse'
    case 'reported':
      return 'bg-orange-400'
    case 'scheduled':
      return 'bg-blue-200'
    default:
      return 'bg-surface-500'
  }
}

function statusTextClass(status: string) {
  switch (status) {
    case 'finalized':
      return 'text-match-win/80'
    case 'ongoing':
      return 'text-yellow-400'
    case 'contested':
      return 'text-match-loss'
    case 'reported':
      return 'text-orange-400'
    case 'scheduled':
      return 'text-blue-200'
    default:
      return 'text-muted-color'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'finalized':
      return t('matchCard.statusFinalized')
    case 'ongoing':
      return t('matchCard.statusOngoing')
    case 'contested':
      return t('matchCard.statusContested')
    case 'cancelled':
      return t('matchCard.statusCancelled')
    case 'reported':
      return t('matchCard.statusReported')
    case 'scheduled':
      return t('matchCard.statusScheduled')
    default:
      return status
  }
}

function mmrPillClass(delta: number) {
  if (delta > 0) return 'bg-match-win/15 text-match-win border-match-win/30'
  if (delta < 0) return 'bg-match-loss/15 text-match-loss border-match-loss/30'
  return 'bg-match-neutral/15 text-match-neutral border-match-neutral/30'
}

function formatDate(date: Date | string | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function navigateToMatch(matchId: string) {
  router.push(`/matches/${matchId}`)
}


</script>
