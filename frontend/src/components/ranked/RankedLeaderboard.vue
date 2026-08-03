<template>
  <div class="leaderboard text-white">
    <!-- Loading (first load only) -->
    <div v-if="showFullSpinner" class="flex justify-center items-center h-40">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- Recalculation job in progress -->
      <div v-if="props.isRecalculating" class="flex items-center justify-center gap-2 mb-3 text-sm text-orange-400">
        <i class="fa fa-sync fa-spin" />
        {{ t('rankedLeaderboard.recalculating') }}
      </div>

      <!-- Plain refresh in progress (data already shown) -->
      <div v-else-if="isRefreshing" class="flex items-center justify-center gap-2 mb-3 text-sm text-gray-400">
        <i class="fa fa-sync fa-spin" />
        {{ t('rankedLeaderboard.refreshing') }}
      </div>

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
        {{ t('rankedLeaderboard.noTiers') }}
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
            <i
              :class="tierIconClass(group.tier)"
              class="text-sm w-4 text-center shrink-0"
              :style="{ color: tierTextColor(group.tier) }"
            />
            <span class="font-bold text-sm" :style="{ color: tierTextColor(group.tier) }">{{
              group.tier.name
            }}</span>
            <span class="text-xs text-gray-500 ml-auto shrink-0">{{
              tierThreshold(group.tier)
            }}</span>
          </div>

          <!-- Player rows -->
          <template v-if="group.players.length">
            <RouterLink
              v-for="(player, idx) in group.players"
              :key="player.player?.id ?? idx"
              :to="player.player ? playerLink(player.player.id, props.tournamentId) : '#'"
              class="flex items-center gap-3 px-4 py-2.5 border-t border-white/5 transition-colors"
              :class="
                player.player?.id === currentUserId
                  ? 'bg-primary-900/30 hover:bg-primary-800/40'
                  : 'hover:bg-white/5'
              "
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
                  <span class="font-semibold text-sm truncate">{{
                    player.player?.displayName ?? t('rankedLeaderboard.unknownPlayer')
                  }}</span>
                  <span
                    v-if="player.player?.id === currentUserId"
                    class="text-[9px] font-bold text-primary-400 uppercase tracking-wide shrink-0"
                    >{{ t('rankedLeaderboard.you') }}</span
                  >
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex text-[10px] w-full ">{{ getPlayedMatchLabel(player) }}</div>
                  <div class="flex items-center justify-end w-full mt-1">
                    <RecentFormBadges
                      v-if="player.recentResults?.length"
                      :results="player.recentResults.map(r => r.outcome === 'win' ? 'V' : r.outcome === 'loss' ? 'D' : 'N')"
                    />
                  </div>
                </div>
                <div
                  v-if="!isTopTier(group.tier, props.tiers)"
                  class="mt-1.5 h-1 rounded-full bg-gray-700/50 overflow-hidden"
                >
                  <div
                    class="h-full rounded-full"
                    :class="tierBarClass(group.tier)"
                    :style="{ width: `${tierProgress(player.currentMmr, group.tier)}%` }"
                  />
                </div>
              </div>

              <!-- LP / MMR + streak -->
              <div class="text-right shrink-0">
                <div class="font-black text-sm tabular-nums">{{ player.currentMmr }}</div>
                <div v-if="player.winStreak > 1" class="text-[10px] text-orange-400">
                  🔥 {{ player.winStreak }}
                </div>
                <div v-else-if="player.lossStreak > 1" class="text-[10px] text-blue-400">
                  💀 {{ player.lossStreak }}
                </div>
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
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { playerLink } from '@/utils/player-link'
import { useSwipe } from '@vueuse/core'
import type { ClientPlayerMmr, ClientRankTier } from '@skol-arena/shared/types/index'
import { isTopTier, getNextTier, getPrevTier, getTierForMmr } from '@/composables/ranked/ranked.service'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import RecentFormBadges from '@/components/player/RecentFormBadges.vue'

import {
  TIER_BAR_CLASS as TIER_BAR,
  TIER_CARD_CLASS as TIER_CARD,
  tierStyleIdx,
  getTierIconClass,
  getTierTextHex,
} from '@/composables/ranked/tier-style'

const { t } = useI18n()

const props = defineProps<{
  players: ClientPlayerMmr[]
  provisionalPlayers?: ClientPlayerMmr[]
  tiers: ClientRankTier[]
  loading?: boolean
  provisionalLoading?: boolean
  isRecalculating?: boolean
  currentUserId?: string
  showModeToggle?: boolean
  tournamentId?: string
}>()

const emit = defineEmits<{
  'load-provisional': []
}>()

const leaderboardMode = ref<'official' | 'provisional'>('official')
const contentRef = ref<HTMLElement | null>(null)
const provisionalLoaded = ref(false)

const modeOptions = computed(() => [
  { label: t('rankedLeaderboard.modeOfficial'), value: 'official' },
  { label: t('rankedLeaderboard.modeProvisional'), value: 'provisional' },
])

watch(leaderboardMode, (val) => {
  if (val === 'provisional' && !provisionalLoaded.value) {
    provisionalLoaded.value = true
    emit('load-provisional')
  }
})

useSwipe(contentRef, {
  onSwipeEnd(_e, direction) {
    if (props.showModeToggle === false) return
    if (direction === 'left' && leaderboardMode.value === 'official') {
      leaderboardMode.value = 'provisional'
    } else if (direction === 'right' && leaderboardMode.value === 'provisional') {
      leaderboardMode.value = 'official'
    }
  },
})

const activeLoading = computed(() =>
  leaderboardMode.value === 'provisional' ? props.provisionalLoading : props.loading,
)

const activePlayers = computed(() =>
  leaderboardMode.value === 'provisional' ? (props.provisionalPlayers ?? []) : props.players,
)

// Full-screen spinner only on first load (no data yet). A refresh of an
// already-shown leaderboard keeps the list visible and shows a subtle banner.
const showFullSpinner = computed(() => activeLoading.value && activePlayers.value.length === 0)
const isRefreshing = computed(() => activeLoading.value && activePlayers.value.length > 0)

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
  })),
)

function getPlayerTier(mmr: number): ClientRankTier | null {
  return getTierForMmr(mmr, props.tiers)
}

function tierTextColor(tier: ClientRankTier): string {
  return getTierTextHex(tier)
}

function tierIconClass(tier: ClientRankTier): string {
  return getTierIconClass(tier)
}

function tierCardClass(tier: ClientRankTier): string {
  return TIER_CARD[tierStyleIdx(tier)] ?? 'bg-gray-800/70'
}

function tierBarClass(tier: ClientRankTier): string {
  return TIER_BAR[tierStyleIdx(tier)] ?? 'bg-gray-400'
}

function tierThreshold(tier: ClientRankTier): string {
  const isLowestTier = !getPrevTier(tier, props.tiers)
  if (!isLowestTier) return `${tier.minMmr}+ MMR`
  const above = getNextTier(tier, props.tiers)
  return above ? `< ${above.minMmr} MMR` : `${tier.minMmr}+ MMR`
}

function tierProgress(mmr: number, tier: ClientRankTier): number {
  const next = getNextTier(tier, props.tiers)
  if (!next) return 100
  const range = next.minMmr - tier.minMmr
  if (range <= 0) return 100
  return Math.min(100, Math.max(0, ((mmr - tier.minMmr) / range) * 100))
}

function rankOf(player: ClientPlayerMmr): number | string {
  if (!player.player?.id) return '?'
  return rankMap.value.get(player.player.id) ?? '?'
}

function getPlayedMatchLabel(player: ClientPlayerMmr): string {
  const number = player.matchesPlayed
  if (number === 1) return `${number} ${t('rankedLeaderboard.matchSingular')}`
  if (number >= 2) return `${number} ${t('rankedLeaderboard.matchPlural')}`
  return ''
}
</script>

<style scoped>
.leaderboard {
  max-width: 640px;
  margin: 0 auto;
}
</style>
