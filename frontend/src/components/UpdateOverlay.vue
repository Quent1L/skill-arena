<template>
  <Transition name="update-fade">
    <div v-if="visible" class="update-overlay">
      <div class="update-bg-glow" />
      <div class="update-particles">
        <span v-for="n in 10" :key="n" class="particle" :class="`p${n}`" />
      </div>
      <div class="update-content">
        <SkolLogo :animated="false" />
        <div class="update-text">
          <p class="update-title">{{ t('updateOverlay.title') }}</p>
          <p class="update-subtitle">
            {{ isDownloading ? t('updateOverlay.downloadingSubtitle') : t('updateOverlay.subtitle') }}
          </p>
        </div>
        <div class="update-progress-track">
          <div
            v-if="percent !== null"
            class="update-progress-bar update-progress-measured"
            :style="{ width: `${percent}%` }"
          />
          <div v-else-if="isDownloading" class="update-progress-bar update-progress-indeterminate" />
          <div v-else class="update-progress-bar update-progress-timed" />
        </div>
        <p v-if="percent !== null" class="update-percent">{{ percent }}%</p>
        <p v-if="showSlowHint" class="update-hint">{{ t('updateOverlay.slowHint') }}</p>
        <button v-if="showDismiss" type="button" class="update-dismiss" @click="emit('dismiss')">
          {{ t('updateOverlay.continueAnyway') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SkolLogo from '@/components/SkolLogo.vue'
import type { UpdatePhase } from '@/composables/pwa/pwa.update'

/** Past this, say out loud that a slow connection is the likely explanation. */
const SLOW_HINT_MS = 5000
/** Past this, stop holding the app hostage: offer to keep using it. */
const DISMISS_MS = 15000

const { t } = useI18n()

const props = withDefaults(
  defineProps<{ visible: boolean; phase?: UpdatePhase; progress?: number | null }>(),
  { phase: 'applying', progress: null },
)

const emit = defineEmits<{ dismiss: [] }>()

const showSlowHint = ref(false)
const showDismiss = ref(false)
let timers: ReturnType<typeof setTimeout>[] = []

const isDownloading = computed(() => props.phase === 'downloading')
const percent = computed(() =>
  isDownloading.value && props.progress !== null ? Math.round(props.progress * 100) : null,
)

function clearTimers(): void {
  timers.forEach(clearTimeout)
  timers = []
}

// The escalation is time-based, not phase-based: what matters to the user is how
// long they have been staring at this screen, whatever the worker is doing.
watch(
  () => props.visible,
  (visible) => {
    clearTimers()
    showSlowHint.value = false
    showDismiss.value = false
    if (!visible) return
    timers.push(setTimeout(() => (showSlowHint.value = true), SLOW_HINT_MS))
    timers.push(setTimeout(() => (showDismiss.value = true), DISMISS_MS))
  },
  { immediate: true },
)

onUnmounted(clearTimers)
</script>

<style scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: #0f0d1a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.update-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.update-bg-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 48%, rgba(124, 58, 237, 0.18) 0%, transparent 65%);
  animation: glow-breathe 4s ease-in-out infinite;
}

@keyframes glow-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.35);
    opacity: 1;
  }
}

.update-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: #a78bfa;
  animation: float-up linear infinite;
  bottom: -8px;
}

@keyframes float-up {
  0% {
    transform: translateY(0) scaleX(1);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-100vh) scaleX(0.6);
    opacity: 0;
  }
}

.p1 {
  width: 3px;
  height: 3px;
  left: 8%;
  animation-duration: 9s;
  animation-delay: 0s;
  opacity: 0.5;
}
.p2 {
  width: 2px;
  height: 2px;
  left: 18%;
  animation-duration: 7s;
  animation-delay: 2.2s;
  opacity: 0.3;
}
.p3 {
  width: 4px;
  height: 4px;
  left: 28%;
  animation-duration: 11s;
  animation-delay: 0.8s;
  opacity: 0.4;
}
.p4 {
  width: 2px;
  height: 2px;
  left: 40%;
  animation-duration: 8s;
  animation-delay: 3.5s;
  opacity: 0.35;
}
.p5 {
  width: 3px;
  height: 3px;
  left: 52%;
  animation-duration: 10s;
  animation-delay: 1.2s;
  opacity: 0.45;
}
.p6 {
  width: 2px;
  height: 2px;
  left: 63%;
  animation-duration: 7s;
  animation-delay: 4.1s;
  opacity: 0.3;
}
.p7 {
  width: 4px;
  height: 4px;
  left: 73%;
  animation-duration: 9s;
  animation-delay: 0.4s;
  opacity: 0.4;
}
.p8 {
  width: 2px;
  height: 2px;
  left: 82%;
  animation-duration: 12s;
  animation-delay: 2.8s;
  opacity: 0.35;
}
.p9 {
  width: 3px;
  height: 3px;
  left: 91%;
  animation-duration: 8s;
  animation-delay: 5s;
  opacity: 0.4;
}
.p10 {
  width: 2px;
  height: 2px;
  left: 46%;
  animation-duration: 10s;
  animation-delay: 6.3s;
  opacity: 0.3;
}

.update-text {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.update-title {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 1.25rem;
  color: #a78bfa;
  letter-spacing: 0.05em;
  margin: 0;
}

.update-subtitle {
  font-size: 0.875rem;
  color: rgba(167, 139, 250, 0.6);
  margin: 0;
}

.update-progress-track {
  width: 200px;
  height: 3px;
  background: rgba(167, 139, 250, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.update-progress-bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
  border-radius: 2px;
}

/* Timed bar: the handover is near-instant, the bar just paces UPDATE_OVERLAY_MIN_MS. */
.update-progress-timed {
  animation: progress-fill 1.5s linear forwards;
}

@keyframes progress-fill {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}

/* Real precache progress, width driven by the worker's messages. */
.update-progress-measured {
  transition: width 0.25s ease-out;
}

/* Fallback while the worker has not reported anything yet. */
.update-progress-indeterminate {
  width: 40%;
  animation: progress-sweep 1.4s ease-in-out infinite;
}

@keyframes progress-sweep {
  0% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(260%);
  }
}

.update-percent {
  font-family: 'Rajdhani', sans-serif;
  font-size: 0.8125rem;
  color: rgba(167, 139, 250, 0.75);
  margin: -18px 0 0;
  font-variant-numeric: tabular-nums;
}

.update-hint {
  max-width: 260px;
  text-align: center;
  font-size: 0.75rem;
  line-height: 1.4;
  color: rgba(167, 139, 250, 0.45);
  margin: -14px 0 0;
  animation: hint-in 0.4s ease;
}

@keyframes hint-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.update-dismiss {
  padding: 8px 18px;
  border: 1px solid rgba(167, 139, 250, 0.35);
  border-radius: 6px;
  background: transparent;
  color: #a78bfa;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
  animation: hint-in 0.4s ease;
}

.update-dismiss:hover {
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.6);
}

.update-fade-enter-active {
  transition: opacity 0.3s ease;
}
.update-fade-enter-from {
  opacity: 0;
}
</style>
