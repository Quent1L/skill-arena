<template>
  <div class="leaderboard  rounded-2xl p-4 text-white">
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center h-40">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- Tier summary bar -->
      <div class="grid grid-cols-4 gap-2 mb-6">
        <div
          v-for="tier in tierSummary"
          :key="tier.key"
          class="rounded-xl p-3 text-center"
          :class="tier.bgClass"
        >
          <div class="text-xs font-bold uppercase tracking-wider opacity-80">{{ tier.label }}</div>
          <div class="text-lg font-black mt-0.5">{{ tier.threshold }}</div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="players.length === 0" class="text-center py-12 text-gray-500">
        <i class="fa fa-trophy text-4xl mb-4 block opacity-30"></i>
        Aucun joueur classé pour cette saison
      </div>

      <template v-else>
        <!-- Podium top 3 -->
        <div class="flex items-end justify-center gap-3 mb-6">
          <!-- #2 -->
          <div v-if="players[1]" class="flex-1 max-w-[150px]">
            <PodiumCard :player="players[1]" :rank="2" :tiers="tiers" :current-user-id="currentUserId" />
          </div>
          <!-- Spacer if only 1 player -->
          <div v-else-if="players.length >= 1" class="flex-1 max-w-[150px]" />

          <!-- #1 -->
          <div class="flex-1 max-w-[170px]">
            <PodiumCard :player="players[0]" :rank="1" :tiers="tiers" :featured="true" :current-user-id="currentUserId" />
          </div>

          <!-- #3 -->
          <div v-if="players[2]" class="flex-1 max-w-[150px]">
            <PodiumCard :player="players[2]" :rank="3" :tiers="tiers" :current-user-id="currentUserId" />
          </div>
          <!-- Spacer if fewer than 3 players -->
          <div v-else-if="players.length >= 1" class="flex-1 max-w-[150px]" />
        </div>

        <!-- Rest of leaderboard (rank 4+) -->
        <div v-if="restPlayers.length > 0" class="space-y-2">
          <RouterLink
            v-for="(player, index) in restPlayers"
            :key="player.player?.id ?? index"
            :to="player.player ? `/players/${player.player.id}` : '#'"
            class="flex items-center gap-3 transition-colors rounded-xl px-4 py-3"
            :class="player.player?.id === currentUserId
              ? 'bg-primary-900/30 hover:bg-primary-800/40 ring-1 ring-primary-500/40'
              : 'bg-gray-800 hover:bg-gray-700'"
          >
            <!-- Rank number -->
            <div class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
              {{ index + 4 }}
            </div>

            <!-- Avatar -->
            <Avatar
              :label="getInitials(player.player?.displayName)"
              shape="circle"
              class="shrink-0 text-white"
              :class="tierAvatarClass(getPlayerRank(player.currentMmr))"
            />

            <!-- Name + tier -->
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate">{{ player.player?.displayName ?? 'Inconnu' }}</div>
              <div class="text-xs mt-0.5" :class="tierTextClass(getPlayerRank(player.currentMmr))">
                {{ tierLabel(getPlayerRank(player.currentMmr)) }}
              </div>
            </div>

            <!-- MMR + streak -->
            <div class="text-right shrink-0">
              <div class="font-black text-base">{{ player.currentMmr }}</div>
              <div v-if="player.winStreak > 1" class="text-xs text-orange-400">
                🔥 {{ player.winStreak }}
              </div>
            </div>
          </RouterLink>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue'
import { RouterLink } from 'vue-router'
import type { ClientPlayerMmr, ClientRankTier } from '@skill-arena/shared/types/index'

const TIER_TEXT_CLASSES = ['text-gray-400', 'text-blue-400', 'text-amber-400', 'text-red-400']
const TIER_AVATAR_CLASSES = ['bg-gray-600', 'bg-blue-600', 'bg-amber-500', 'bg-red-600']
const TIER_BG_CLASSES = ['bg-gray-700/60 text-gray-300', 'bg-blue-900/60 text-blue-300', 'bg-amber-900/60 text-amber-300', 'bg-red-900/60 text-red-300']

const props = defineProps<{
  players: ClientPlayerMmr[]
  tiers: ClientRankTier[]
  loading?: boolean
  currentUserId?: string
}>()

const restPlayers = computed(() => props.players.slice(3))

function getPlayerRank(mmr: number): ClientRankTier | null {
  if (!props.tiers.length) return null
  return [...props.tiers].sort((a, b) => b.level - a.level).find((t) => mmr >= t.minMmr) ?? props.tiers[0]
}

function styleIdx(tier: ClientRankTier | null): number {
  if (!tier) return 0
  return Math.min(tier.level - 1, TIER_TEXT_CLASSES.length - 1)
}

function tierTextClass(tier: ClientRankTier | null): string {
  return TIER_TEXT_CLASSES[styleIdx(tier)]
}

function tierAvatarClass(tier: ClientRankTier | null): string {
  return TIER_AVATAR_CLASSES[styleIdx(tier)]
}

function tierLabel(tier: ClientRankTier | null): string {
  return tier?.name ?? '—'
}

const tierSummary = computed(() =>
  [...props.tiers]
    .sort((a, b) => b.level - a.level)
    .map((t) => ({
      key: t.name,
      label: t.name,
      threshold: `${t.minMmr}+`,
      bgClass: TIER_BG_CLASSES[Math.min(t.level - 1, TIER_BG_CLASSES.length - 1)],
    })),
)

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

// Inline PodiumCard sub-component
const PodiumCard = defineComponent({
  props: {
    player: { type: Object as () => ClientPlayerMmr, required: true },
    rank: { type: Number, required: true },
    tiers: { type: Array as () => ClientRankTier[], default: () => [] },
    featured: { type: Boolean, default: false },
    currentUserId: { type: String as () => string | undefined, default: undefined },
  },
  setup(p) {
    const tier = computed((): ClientRankTier | null => {
      if (!p.tiers.length) return null
      const mmr = p.player.currentMmr
      return [...p.tiers].sort((a, b) => b.level - a.level).find((t) => mmr >= t.minMmr) ?? p.tiers[0]
    })

    const isMe = computed(() => !!p.currentUserId && p.player.player?.id === p.currentUserId)

    function podiumStyleIdx(): number {
      return tier.value ? Math.min(tier.value.level - 1, TIER_AVATAR_CLASSES.length - 1) : 0
    }

    const rankRing: Record<number, string> = {
      1: 'ring-2 ring-amber-400/70',
      2: 'ring-2 ring-slate-400/60',
      3: 'ring-2 ring-amber-700/60',
    }

    const cardBg: Record<number, string> = { 1: 'bg-gray-700', 2: 'bg-gray-800', 3: 'bg-gray-800' }
    const cardGroupHover: Record<number, string> = {
      1: 'group-hover:bg-gray-600',
      2: 'group-hover:bg-gray-700',
      3: 'group-hover:bg-gray-700',
    }

    const stepBg: Record<number, string> = {
      1: 'bg-amber-600',
      2: 'bg-slate-500',
      3: 'bg-amber-800',
    }
    const stepGroupHover: Record<number, string> = {
      1: 'group-hover:bg-amber-500',
      2: 'group-hover:bg-slate-400',
      3: 'group-hover:bg-amber-700',
    }
    const stepHeight: Record<number, string> = { 1: 'h-14', 2: 'h-8', 3: 'h-4' }

    const initials = computed(() => {
      const name = p.player.player?.displayName
      if (!name) return '?'
      return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
    })

    const rankMedal = computed(() => {
      if (p.rank === 1) return '🥇'
      if (p.rank === 2) return '🥈'
      return '🥉'
    })

    return () =>
      h(
        RouterLink,
        { to: p.player.player ? `/players/${p.player.player.id}` : '#', class: 'block group' },
        () =>
          h('div', {
            class: [
              'rounded-2xl overflow-hidden transition-colors',
              isMe.value ? 'ring-2 ring-primary-400' : rankRing[p.rank],
            ],
          }, [
            // Card content
            h('div', {
              class: [
                'p-3 text-center flex flex-col items-center gap-1 transition-colors',
                cardBg[p.rank],
                cardGroupHover[p.rank],
              ],
            }, [
              // Medal
              h('div', { class: 'text-2xl leading-none' }, rankMedal.value),

              // "Vous" badge
              isMe.value
                ? h('div', { class: 'text-[10px] font-bold text-primary-400 uppercase tracking-widest' }, 'Vous')
                : null,

              // Avatar circle
              h('div', {
                class: [
                  'rounded-full flex items-center justify-center font-black text-white',
                  TIER_AVATAR_CLASSES[podiumStyleIdx()],
                  p.featured ? 'w-14 h-14 text-lg' : 'w-11 h-11 text-sm',
                ],
              }, initials.value),

              // Name
              h('div', { class: 'font-bold text-xs text-white truncate w-full leading-tight mt-0.5' },
                p.player.player?.displayName ?? 'Inconnu'),

              // Tier
              h('div', { class: ['text-xs font-semibold uppercase tracking-wide', TIER_TEXT_CLASSES[podiumStyleIdx()]] },
                tier.value?.name ?? '—'),

              // MMR
              h('div', {
                class: ['font-black tabular-nums', p.featured ? 'text-xl text-white' : 'text-lg text-gray-200'],
              }, String(p.player.currentMmr)),
            ]),

            // Podium step
            h('div', {
              class: [
                'flex items-center justify-center font-black text-white/70 text-sm transition-colors',
                stepBg[p.rank],
                stepGroupHover[p.rank],
                stepHeight[p.rank],
              ],
            }, `#${p.rank}`),
          ]),
      )
  },
})
</script>

<style scoped>
.leaderboard {
  max-width: 640px;
  margin: 0 auto;
}
</style>
