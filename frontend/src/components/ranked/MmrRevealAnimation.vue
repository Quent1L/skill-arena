<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/85">
      <div
        class="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-gray-900 text-white shadow-2xl overflow-hidden"
        :class="phase !== 'done' ? 'pb-6' : 'pb-2'"
      >
        <!-- Type badge -->
        <div class="flex justify-center pt-5 pb-1">
          <span
            class="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            :class="
              isProvisional
                ? 'bg-gray-700 text-gray-300'
                : 'bg-amber-500/20 text-amber-400'
            "
          >
            {{ isProvisional ? 'Résultat provisoire' : 'Résultat officiel' }}
          </span>
        </div>

        <!-- Rank badge area -->
        <div class="flex flex-col items-center gap-1 py-4 px-6 min-h-[96px]">
          <Transition name="badge-exit" mode="out-in">
            <div
              v-if="phase === 'rank_up_exit'"
              key="old"
              class="flex flex-col items-center gap-1"
            >
              <div class="text-4xl font-black text-gray-400">{{ event.tierBeforeName ?? '—' }}</div>
            </div>
            <div
              v-else
              key="current"
              class="flex flex-col items-center gap-1"
            >
              <Transition name="badge-enter">
                <div
                  v-if="phase !== 'entry'"
                  class="text-4xl font-black"
                  :class="currentTierClass"
                >
                  {{ displayTierName }}
                </div>
              </Transition>
            </div>
          </Transition>

          <Transition name="rank-up-text">
            <div
              v-if="phase === 'rank_up_in' || phase === 'rank_up_hold'"
              class="text-amber-400 font-black text-lg uppercase tracking-widest animate-bounce"
            >
              Montée en rang !
            </div>
          </Transition>
        </div>

        <!-- MMR counter -->
        <div class="flex items-center justify-center gap-3 px-6 pb-3">
          <span class="text-gray-400 text-2xl font-mono">{{ event.mmrBefore }}</span>
          <span class="text-gray-500">→</span>
          <span
            class="text-3xl font-black font-mono transition-colors duration-500"
            :class="mmrCounterClass"
          >{{ displayMmr }}</span>
          <span
            class="text-lg font-bold"
            :class="event.mmrDelta >= 0 ? 'text-emerald-400' : 'text-red-400'"
          >
            {{ event.mmrDelta >= 0 ? '+' : '' }}{{ event.mmrDelta }}
          </span>
        </div>

        <!-- Progress bar -->
        <div class="px-6 pb-4">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>{{ tierMinMmr }}</span>
            <span>{{ tierMaxMmr !== null ? tierMaxMmr : '∞' }}</span>
          </div>
          <div class="h-3 w-full rounded-full overflow-hidden bg-gray-700">
            <div
              class="h-full rounded-full transition-all duration-1000 ease-out"
              :style="barStyle"
            />
          </div>
        </div>

        <!-- Dismiss button -->
        <div class="px-6 pt-2">
          <Transition name="fade-up">
            <button
              v-if="phase === 'done'"
              class="w-full py-3 rounded-xl font-semibold text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
              @click="$emit('close')"
            >
              Continuer
            </button>
          </Transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { MmrAnimationEventResponse, ClientRankTier } from '@skill-arena/shared'

const props = defineProps<{
  event: MmrAnimationEventResponse
  tiers: ClientRankTier[]
}>()

defineEmits<{ (e: 'close'): void }>()

type Phase = 'entry' | 'counting' | 'settled' | 'rank_up_exit' | 'rank_up_in' | 'rank_up_hold' | 'done'

const phase = ref<Phase>('entry')
const displayMmr = ref(props.event.mmrBefore)
const barFillPercent = ref(0)
const barHighlighted = ref(false)

const isProvisional = computed(() => props.event.eventType === 'provisional')

function getTierForLevel(level: number | null) {
  if (level === null || !props.tiers.length) return null
  return props.tiers.find((t) => t.level === level) ?? null
}

const tierBefore = computed(() => getTierForLevel(props.event.tierBeforeLevel))
const tierAfter = computed(() => getTierForLevel(props.event.tierAfterLevel))

const displayTierName = computed(() => {
  if (phase.value === 'rank_up_in' || phase.value === 'rank_up_hold' || phase.value === 'done') {
    return props.event.tierAfterName ?? '—'
  }
  return props.event.tierBeforeName ?? '—'
})

function mmrToPercent(mmr: number, minMmr: number, maxMmr: number | null): number {
  if (maxMmr === null) return Math.min(100, Math.max(0, mmr - minMmr) / 100 * 10)
  const range = maxMmr - minMmr
  if (range <= 0) return 100
  return Math.min(100, Math.max(0, ((mmr - minMmr) / range) * 100))
}

const tierMinMmr = computed(() => {
  const tier = tierAfter.value ?? tierBefore.value
  return tier?.minMmr ?? 0
})

const tierMaxMmr = computed((): number | null => {
  const tier = tierAfter.value ?? tierBefore.value
  if (!tier || !props.tiers.length) return null
  const sorted = [...props.tiers].sort((a, b) => a.level - b.level)
  const idx = sorted.findIndex((t) => t.level === tier.level)
  return sorted[idx + 1]?.minMmr ?? null
})

const barStyle = computed(() => {
  const fill = `${barFillPercent.value}%`
  if (isProvisional.value) {
    return {
      width: fill,
      background: 'repeating-linear-gradient(45deg, #6b7280 0px 4px, #4b5563 4px 8px)',
    }
  }
  const color = barHighlighted.value ? '#f59e0b' : (tierAfter.value ? '#3b82f6' : '#6b7280')
  return { width: fill, backgroundColor: color }
})

const mmrCounterClass = computed(() => {
  if (isProvisional.value) return 'text-gray-300'
  if (phase.value === 'counting' || phase.value === 'settled') {
    return props.event.mmrDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
  }
  return 'text-white'
})

const currentTierClass = computed(() => {
  if (isProvisional.value) return 'text-gray-400'
  if (props.event.rankChanged && (phase.value === 'rank_up_in' || phase.value === 'rank_up_hold' || phase.value === 'done')) {
    return 'text-amber-400'
  }
  return 'text-white'
})

let rafId: number | null = null

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function runPhase() {
  // Phase 1: entry → counting after 400ms
  setTimeout(() => {
    phase.value = 'counting'
    const startTime = performance.now()
    const duration = 1200
    const from = props.event.mmrBefore
    const to = props.event.mmrAfter

    function tick(now: number) {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      displayMmr.value = Math.round(from + (to - from) * easeOutCubic(t))
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        displayMmr.value = to
        phase.value = 'settled'
        onSettled()
      }
    }
    rafId = requestAnimationFrame(tick)
  }, 400)
}

function onSettled() {
  // Animate the bar fill
  barFillPercent.value = mmrToPercent(props.event.mmrAfter, tierMinMmr.value, tierMaxMmr.value)

  if (!isProvisional.value) {
    barHighlighted.value = true
    // After 800ms, settle to rank color
    setTimeout(() => {
      barHighlighted.value = false
    }, 800)
  }

  if (props.event.rankChanged && !isProvisional.value) {
    setTimeout(() => {
      phase.value = 'rank_up_exit'
      setTimeout(() => {
        phase.value = 'rank_up_in'
        setTimeout(() => {
          phase.value = 'rank_up_hold'
          setTimeout(() => {
            phase.value = 'done'
          }, 1200)
        }, 800)
      }, 400)
    }, 1000)
  } else {
    setTimeout(() => {
      phase.value = 'done'
    }, 800)
  }
}

onMounted(() => {
  // Set initial bar at mmrBefore position
  barFillPercent.value = mmrToPercent(props.event.mmrBefore, tierMinMmr.value, tierMaxMmr.value)
  runPhase()
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.badge-exit-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.badge-exit-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
.badge-exit-enter-active {
  transition: opacity 0.3s;
}
.badge-exit-enter-from {
  opacity: 0;
}

.badge-enter-enter-active {
  animation: badge-bounce 0.5s ease-out;
}

@keyframes badge-bounce {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.25); }
  80% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

.rank-up-text-enter-active {
  transition: opacity 0.3s, transform 0.3s;
}
.rank-up-text-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-up-enter-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
</style>
