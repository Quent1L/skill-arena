<template>
  <div>
    <!-- The header does not stick, so the top of the viewport is the only spot that
         stays visible however far down the page the reader is. -->
    <Transition name="bar-fade">
      <div v-if="active" class="refresh-bar" aria-hidden="true">
        <div class="refresh-bar-sweep" />
      </div>
    </Transition>

    <Transition name="pill-fade">
      <div v-if="active || done" class="refresh-pill" role="status" aria-live="polite">
        <template v-if="active">
          <i class="fa fa-arrows-rotate fa-spin" />
          {{ t('backgroundRefresh.refreshing') }}
        </template>
        <template v-else>
          <i class="fa fa-check" />
          {{ t('backgroundRefresh.updated') }}
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Says that the data on screen is being replaced in the background — and, once, that
 * the replacement landed. It never hides or dims the content: the reader keeps the
 * data they already had, which on a slow mobile connection is the whole point.
 *
 * Deliberately not a toast: `useAppToast` swallows every non-error toast on mobile,
 * which is exactly where a long refresh needs explaining.
 */
defineProps<{
  /** A refresh is running and has lasted long enough to be worth announcing. */
  active: boolean
  /** The announced refresh just finished; the parent clears this after a beat. */
  done: boolean
}>()

const { t } = useI18n()
</script>

<style scoped>
.refresh-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  /* Under PrimeVue's toasts (1100) and far under the brand overlays (9999+). */
  z-index: 900;
  overflow: hidden;
  background: rgba(167, 139, 250, 0.15);
}

/* Same sweep as UpdateOverlay's indeterminate bar: the two waits in this app should
   read as the same gesture. */
.refresh-bar-sweep {
  height: 100%;
  width: 40%;
  border-radius: 2px;
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
  animation: refresh-sweep 1.4s ease-in-out infinite;
}

@keyframes refresh-sweep {
  0% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(260%);
  }
}

.refresh-pill {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #ede9fe;
  background: rgba(30, 27, 55, 0.92);
  border: 1px solid rgba(167, 139, 250, 0.35);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  pointer-events: none;
}

.bar-fade-enter-active,
.bar-fade-leave-active,
.pill-fade-enter-active,
.pill-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.bar-fade-enter-from,
.bar-fade-leave-to {
  opacity: 0;
}

.pill-fade-enter-from,
.pill-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

@media (prefers-reduced-motion: reduce) {
  .refresh-bar-sweep {
    width: 100%;
    animation: none;
    opacity: 0.6;
  }
}
</style>
