<template>
  <div class="leaderboard text-white">
    <!-- Loading -->
    <div v-if="activeLoading" class="flex justify-center items-center h-40">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- Toggle -->
      <div v-if="props.showModeToggle !== false" class="flex justify-center mb-4">
        <SelectButton
          v-model="leaderboardMode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          size="small"
        />
      </div>

      <!-- No tiers configured -->
      <div v-if="!props.tiers.length" class="text-center py-12 text-gray-500">
        <i class="fa fa-trophy text-4xl mb-4 block opacity-30"></i>
        Aucun rang configuré pour cette saison
      </div>

      <!-- Tier sections -->
      <div v-else ref="contentRef" class="space-y-3">
        <div
          v-for="group in tierGroups"
          :key="group.tier.id"
          class="rounded-2xl overflow-hidden"
          :class="tierCardClass(group.tier)"
        >
          <!-- Tier header -->
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="w-1 h-5 rounded-full shrink-0" :class="tierBarClass(group.tier)" />
            <i :class="tierIconClass(group.tier)" class="text-sm w-4 text-center shrink-0" :style="{ color: tierTextColor(group.tier) }" />
            <span class="font-bold text-sm" :style="{ color: tierTextColor(group.tier) }">{{ group.tier.name }}</span>
            <span class="text-xs text-gray-500 ml-auto shrink-0">{{ tierThreshold(group.tier) }}</span>
          </div>

          <!-- Player rows -->
          <template v-if="group.players.length">
            <RouterLink
              v-for="(player, idx) in group.players"
              :key="player.player?.id ?? idx"
              :to="player.player ? `/players/${player.player.id}` : '#'"
              class="flex items-center gap-3 px-4 py-2.5 border-t border-white/5 transition-colors"
              :class="player.player?.id === currentUserId
                ? 'bg-primary-900/30 hover:bg-primary-800/40'
                : 'hover:bg-white/5'"
            >
              <!-- Global rank -->
              <div class="w-5 text-center text-xs font-bold text-gray-500 shrink-0">
                {{ rankOf(player) }}
              </div>

              <!-- Avatar -->
              <PlayerAvatar
                :name="player.player?.displayName ?? '?'"
                shape="square"
                size="sm"
                class="shrink-0"
              />

              <!-- Name + recent matches + progress bar -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-semibold text-sm truncate">{{ player.player?.displayName ?? 'Inconnu' }}</span>
                  <span v-if="player.player?.id === currentUserId" class="text-[9px] font-bold text-primary-400 uppercase tracking-wide shrink-0">Vous</span>
                </div>
                <div class="flex items-center gap-0.5 mt-1">
                  <span
                    v-for="(r, i) in (player.recentResults ?? [])"
                    :key="i"
                    class="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center shrink-0"
                    :class="r.outcome === 'win' ? 'bg-green-600' : r.outcome === 'loss' ? 'bg-red-600' : 'bg-gray-600'"
                  >{{ r.outcome === 'win' ? 'V' : r.outcome === 'loss' ? 'D' : 'N' }}</span>
                </div>
                <div v-if="!isTopTier(group.tier, props.tiers)" class="mt-1.5 h-1 rounded-full bg-gray-700/50 overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="tierBarClass(group.tier)"
                    :style="{ width: `${tierProgress(player.currentMmr, group.tier)}%` }"
                  />
                </div>
              </div>

              <!-- LP / MMR + streak -->
              <div class="text-right shrink-0">
                <div class="font-black text-sm tabular-nums">{{ lpDisplay(player.currentMmr) }}</div>
                <div v-if="player.winStreak > 1" class="text-[10px] text-orange-400">🔥 {{ player.winStreak }}</div>
              </div>
            </RouterLink>
          </template>

          <!-- Empty state -->

        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useSwipe } from '@vueuse/core'
import type { ClientPlayerMmr, ClientRankTier } from '@skill-arena/shared/types/index'
import { getLp, isTopTier } from '@/composables/ranked/ranked.service'
import PlayerAvatar from '@/components/PlayerAvatar.vue'

const TIER_BAR        = ['bg-gray-400', 'bg-blue-400', 'bg-amber-400', 'bg-orange-400', 'bg-purple-500']
const TIER_ICON       = ['fa fa-seedling', 'fa fa-shield', 'fa fa-star', 'fa fa-gem', 'fa fa-crown']
const TIER_CARD       = ['bg-gray-800/70', 'bg-blue-950/60', 'bg-amber-950/60', 'bg-orange-950/60', 'bg-purple-950/60']
const TIER_TEXT_HEX   = ['#9ca3af', '#60a5fa', '#fbbf24', '#fb923c', '#a855f7']

const props = defineProps<{
  players: ClientPlayerMmr[]
  provisionalPlayers?: ClientPlayerMmr[]
  tiers: ClientRankTier[]
  loading?: boolean
  provisionalLoading?: boolean
  currentUserId?: string
  showModeToggle?: boolean
}>()

const emit = defineEmits<{
  'load-provisional': []
}>()

const leaderboardMode = ref<'official' | 'provisional'>('official')
const contentRef = ref<HTMLElement | null>(null)
const provisionalLoaded = ref(false)

const modeOptions = [
  { label: 'Officiel', value: 'official' },
  { label: 'Provisoire (Live)', value: 'provisional' },
]

watch(leaderboardMode, (val) => {
  if (val === 'provisional' && !provisionalLoaded.value) {
    provisionalLoaded.value = true
    emit('load-provisional')
  }
})

useSwipe(contentRef, {
  onSwipeEnd(_e, direction) {
    if (direction === 'left' && leaderboardMode.value === 'official') {
      leaderboardMode.value = 'provisional'
    } else if (direction === 'right' && leaderboardMode.value === 'provisional') {
      leaderboardMode.value = 'official'
    }
  },
})

const activeLoading = computed(() =>
  leaderboardMode.value === 'provisional' ? props.provisionalLoading : props.loading
)

const activePlayers = computed(() =>
  leaderboardMode.value === 'provisional' ? (props.provisionalPlayers ?? []) : props.players
)

const rankMap = computed(() => {
  const map = new Map<string, number>()
  activePlayers.value.forEach((p, i) => {
    if (p.player?.id) map.set(p.player.id, i + 1)
  })
  return map
})

const sortedTiers = computed(() => [...props.tiers].sort((a, b) => b.level - a.level))

const tierGroups = computed(() =>
  sortedTiers.value.map((tier) => ({
    tier,
    players: activePlayers.value.filter((p) => getPlayerTier(p.currentMmr)?.id === tier.id),
  }))
)

function getPlayerTier(mmr: number): ClientRankTier | null {
  if (!props.tiers.length) return null
  return [...props.tiers].sort((a, b) => b.level - a.level).find((t) => mmr >= t.minMmr) ?? props.tiers[0]
}

function styleIdx(tier: ClientRankTier): number {
  return Math.min(tier.level - 1, TIER_BAR.length - 1)
}

function tierTextColor(tier: ClientRankTier): string {
  return TIER_TEXT_HEX[styleIdx(tier)] ?? '#9ca3af'
}

function tierIconClass(tier: ClientRankTier): string {
  return TIER_ICON[styleIdx(tier)] ?? 'fa fa-circle'
}

function tierCardClass(tier: ClientRankTier): string {
  return TIER_CARD[styleIdx(tier)] ?? 'bg-gray-800/70'
}

function tierBarClass(tier: ClientRankTier): string {
  return TIER_BAR[styleIdx(tier)] ?? 'bg-gray-400'
}

function tierThreshold(tier: ClientRankTier): string {
  const sorted = [...props.tiers].sort((a, b) => a.level - b.level)
  if (tier.level === sorted[0]?.level) {
    const above = sorted.find((t) => t.level === tier.level + 1)
    return above ? `< ${above.minMmr} MMR` : `${tier.minMmr}+ MMR`
  }
  return `${tier.minMmr}+ MMR`
}

function tierProgress(mmr: number, tier: ClientRankTier): number {
  const sorted = [...props.tiers].sort((a, b) => a.level - b.level)
  const next = sorted.find((t) => t.level === tier.level + 1)
  if (!next) return 100
  const range = next.minMmr - tier.minMmr
  if (range <= 0) return 100
  return Math.min(100, Math.max(0, ((mmr - tier.minMmr) / range) * 100))
}

function lpDisplay(mmr: number): string {
  const tier = getPlayerTier(mmr)
  if (!tier) return String(mmr)
  if (isTopTier(tier, props.tiers)) return `${mmr.toLocaleString()} MMR`
  return `${getLp(mmr, tier)} LP`
}

function rankOf(player: ClientPlayerMmr): number | string {
  if (!player.player?.id) return '?'
  return rankMap.value.get(player.player.id) ?? '?'
}
</script>

<style scoped>
.leaderboard {
  max-width: 640px;
  margin: 0 auto;
}
</style>
