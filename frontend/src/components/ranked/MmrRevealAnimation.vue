<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[500] flex items-center justify-center bg-black/85 px-4">
      <div class="w-full max-w-sm rounded-3xl bg-gray-900 text-white shadow-2xl overflow-hidden">

        <!-- Rank badge area -->
        <div class="flex flex-col items-center gap-2 py-6 px-6 min-h-28">
          <div v-if="reasonLabel" class="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-gray-800 text-gray-400">
            {{ reasonLabel }}
          </div>
          <Transition name="badge-exit" mode="out-in">
            <div v-if="phase === 'rank_up_exit'" key="old" class="flex flex-col items-center gap-2">
              <i
                :class="tierBeforeIconClass"
                class="text-5xl"
                :style="{ color: tierBeforeColor }"
              />
              <div class="text-3xl font-black text-gray-400">{{ event.tierBeforeName ?? '—' }}</div>
            </div>
            <div v-else key="current" class="flex flex-col items-center gap-2">
              <Transition name="badge-enter">
                <div v-if="phase !== 'entry'" class="flex flex-col items-center gap-2">
                  <i
                    :class="[
                      currentIconClass,
                      phase === 'rank_up_in' || phase === 'rank_up_hold' ? 'tier-icon-glow' : '',
                    ]"
                    class="text-5xl"
                    :style="{ color: currentTierColor, '--glow-color': currentTierColor }"
                  />
                  <div class="text-3xl font-black" :class="currentTierClass">
                    {{ displayTierName }}
                  </div>
                </div>
              </Transition>
            </div>
          </Transition>

          <Transition name="rank-up-text">
            <div
              v-if="phase === 'rank_up_in' || phase === 'rank_up_hold'"
              class="font-black text-base uppercase tracking-widest"
              :class="rankChangeTextClass"
            >
              {{ rankChangeText }}
            </div>
          </Transition>
        </div>

        <!-- MMR counter -->
        <div class="flex items-center justify-center gap-3 px-6 pb-3">
          <span class="text-gray-400 text-xl font-mono">{{ event.mmrBefore }}</span>
          <span class="text-gray-500">→</span>
          <span
            class="text-3xl font-black font-mono transition-colors duration-500"
            :class="mmrCounterClass"
          >{{ displayMmr }}</span>
          <Transition name="delta-pop">
            <span
              v-if="phase === 'settled' || phase === 'rank_up_exit' || phase === 'rank_up_in' || phase === 'rank_up_hold' || phase === 'done'"
              class="text-2xl font-black"
              :class="event.mmrDelta >= 0 ? 'text-emerald-400' : 'text-red-400'"
            >
              {{ event.mmrDelta >= 0 ? '+' : '' }}{{ event.mmrDelta }}
            </span>
          </Transition>
        </div>

        <!-- Encouragement message -->
        <Transition name="fade-up">
          <div
            v-if="props.event.encouragementMessage && (phase === 'settled' || phase === 'done')"
            class="text-center px-6 pb-2 text-sm font-semibold"
            :class="encouragementClass"
          >
            {{ props.event.encouragementMessage }}
          </div>
        </Transition>

        <!-- Progress bar -->
        <div class="px-6 pb-5">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>{{ tierMinMmr }}</span>
            <span>{{ tierMaxMmr !== null ? tierMaxMmr : '∞' }}</span>
          </div>
          <div class="h-3 w-full rounded-full overflow-hidden bg-gray-700 relative">
            <div class="absolute h-full" :style="barBaseStyle" />
            <div v-if="!isProvisional" class="absolute h-full" :style="barDeltaStyle" />
          </div>
        </div>

        <!-- Dismiss button -->
        <div class="px-6 pb-6">
          <Transition name="fade-up">
            <button
              v-if="phase === 'done'"
              class="w-full py-3 rounded-xl font-semibold text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
              @click="$emit('close')"
            >
              {{ t('mmrRevealAnimation.continue') }}
            </button>
          </Transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MmrAnimationEventResponse, ClientRankTier } from '@skill-arena/shared'
import { getTierIconClass, getTierTextHex } from '@/composables/ranked/tier-style'

const { t } = useI18n()

const props = defineProps<{
  event: MmrAnimationEventResponse
  tiers: ClientRankTier[]
}>()

defineEmits<{ (e: 'close'): void }>()

type Phase = 'entry' | 'counting' | 'settled' | 'rank_up_exit' | 'rank_up_in' | 'rank_up_hold' | 'done'

const phase = ref<Phase>('entry')
const displayMmr = ref(props.event.mmrBefore)
const barBlueWidth = ref(0)
const barDeltaLeft = ref(0)
const barDeltaWidth = ref(0)

const isProvisional = computed(() => props.event.eventType === 'provisional')

const reasonLabel = computed(() => {
  if (props.event.reason === 'match_cancelled') return t('mmrRevealAnimation.matchCancelled')
  if (props.event.reason === 'cascade') return t('mmrRevealAnimation.mmrRecalculation')
  return null
})

function getTierForLevel(level: number | null) {
  if (level === null || !props.tiers.length) return null
  return props.tiers.find((t) => t.level === level) ?? null
}


const tierBefore = computed(() => getTierForLevel(props.event.tierBeforeLevel))
const tierAfter = computed(() => getTierForLevel(props.event.tierAfterLevel))

const tierBeforeIconClass = computed(() => getTierIconClass(tierBefore.value))
const tierAfterIconClass = computed(() => getTierIconClass(tierAfter.value))
const tierBeforeColor = computed(() => getTierTextHex(tierBefore.value))
const tierAfterColor = computed(() => getTierTextHex(tierAfter.value))

const isRankUpPhase = (p: Phase) =>
  p === 'rank_up_in' || p === 'rank_up_hold' || p === 'done'

const currentIconClass = computed(() =>
  isRankUpPhase(phase.value) ? tierAfterIconClass.value : tierBeforeIconClass.value,
)

const currentTierColor = computed(() =>
  isRankUpPhase(phase.value) ? tierAfterColor.value : tierBeforeColor.value,
)

const rankDirection = computed(() =>
  (props.event.tierAfterLevel ?? 0) >= (props.event.tierBeforeLevel ?? 0) ? 'up' : 'down',
)

const rankChangeText = computed(() =>
  rankDirection.value === 'up' ? t('mmrRevealAnimation.rankUp') : t('mmrRevealAnimation.rankDown'),
)

const rankChangeTextClass = computed(() =>
  rankDirection.value === 'up'
    ? 'text-amber-400 animate-bounce'
    : 'text-red-400 animate-pulse',
)

const displayTierName = computed(() => {
  if (isRankUpPhase(phase.value)) return props.event.tierAfterName ?? '—'
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

const barBaseStyle = computed(() => {
  if (isProvisional.value) {
    return {
      width: `${barBlueWidth.value + barDeltaWidth.value}%`,
      background: 'repeating-linear-gradient(45deg, #6b7280 0px 4px, #4b5563 4px 8px)',
      transition: 'width 1s ease-out',
    }
  }
  const tierColor = tierAfter.value ? '#3b82f6' : '#6b7280'
  return { width: `${barBlueWidth.value}%`, backgroundColor: tierColor, transition: 'width 1s ease-out' }
})

const barDeltaStyle = computed(() => {
  const color = props.event.mmrDelta >= 0 ? '#10b981' : '#ef4444'
  return {
    left: `${barDeltaLeft.value}%`,
    width: `${barDeltaWidth.value}%`,
    backgroundColor: color,
    transition: 'width 1s ease-out, left 1s ease-out',
  }
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
  if (props.event.rankChanged && isRankUpPhase(phase.value)) return 'text-amber-400'
  return 'text-white'
})


const encouragementClass = computed(() => {
  if (isProvisional.value) return 'text-gray-400'
  if (props.event.mmrDelta > 0) return 'text-emerald-400'
  if (props.event.mmrDelta < 0) return 'text-red-400'
  return 'text-gray-400'
})

let rafId: number | null = null

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function runPhase() {
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
  const beforePct = mmrToPercent(props.event.mmrBefore, tierMinMmr.value, tierMaxMmr.value)
  const afterPct = mmrToPercent(props.event.mmrAfter, tierMinMmr.value, tierMaxMmr.value)

  if (isProvisional.value) {
    barBlueWidth.value = afterPct
  } else if (props.event.mmrDelta >= 0) {
    barDeltaWidth.value = afterPct - beforePct
  } else {
    barBlueWidth.value = afterPct
    barDeltaLeft.value = afterPct
    barDeltaWidth.value = beforePct - afterPct
  }

  if (props.event.rankChanged && !isProvisional.value) {
    runPhaseSequence([
      { phase: 'rank_up_exit', delay: 1000 },
      { phase: 'rank_up_in', delay: 400 },
      { phase: 'rank_up_hold', delay: 800 },
      { phase: 'done', delay: 1200 },
    ])
  } else {
    setTimeout(() => {
      phase.value = 'done'
    }, 1200)
  }
}

function runPhaseSequence(steps: { phase: Phase; delay: number }[]) {
  let index = 0
  const next = () => {
    if (index >= steps.length) return
    const step = steps[index++]
    setTimeout(() => {
      phase.value = step.phase
      next()
    }, step.delay)
  }
  next()
}

onMounted(() => {
  const startPct = mmrToPercent(props.event.mmrBefore, tierMinMmr.value, tierMaxMmr.value)
  barBlueWidth.value = startPct
  barDeltaLeft.value = startPct
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
  transform: translateY(-16px) scale(0.85);
}
.badge-exit-enter-active {
  transition: opacity 0.3s;
}
.badge-exit-enter-from {
  opacity: 0;
}

.badge-enter-enter-active {
  animation: badge-bounce 0.55s ease-out;
}

@keyframes badge-bounce {
  0% { transform: scale(0); opacity: 0; }
  55% { transform: scale(1.3); }
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
  transition: opacity 0.4s, transform 0.4s;
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.delta-pop-enter-active {
  animation: delta-bounce 0.45s ease-out;
}

@keyframes delta-bounce {
  0% { transform: scale(0.4); opacity: 0; }
  55% { transform: scale(1.3); }
  80% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}


.tier-icon-glow {
  animation: icon-glow 1.4s ease-in-out infinite;
}

@keyframes icon-glow {
  0%, 100% { filter: drop-shadow(0 0 6px var(--glow-color, #fff)); transform: scale(1); }
  50% { filter: drop-shadow(0 0 20px var(--glow-color, #fff)); transform: scale(1.12); }
}
</style>
