<template>
  <!-- Mirrors the chrome the tournament will render, down to the tab actually being
       opened, so the page settles rather than being rebuilt when the data lands. -->
  <div class="sk-shimmer" :class="variant === 'mobile' ? '' : 'min-h-screen bg-gray-50 dark:bg-gray-900'">
    <!-- Mobile sub-page (teams, badges): its own back bar, no bottom nav. -->
    <div v-if="isMobileSubPage" class="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <div
        class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 flex items-center px-4 shadow-sm gap-3"
      >
        <Skeleton shape="circle" size="2.5rem" />
        <Skeleton height="1rem" width="8rem" />
      </div>
      <div class="flex-1 p-4">
        <TournamentTabSkeleton :tab="tab" variant="mobile" />
      </div>
    </div>

    <template v-else-if="variant === 'mobile'">
      <div class="flex flex-col bg-gray-50 dark:bg-gray-900" style="min-height: calc(100vh - 7rem)">
        <div class="flex-1 p-4 pb-20 space-y-4">
          <!-- TournamentHeader lives in the infos tab only. -->
          <template v-if="!tab || tab === 'infos'">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Skeleton height="1.5rem" width="5rem" class="rounded-full!" />
                <Skeleton height="1.5rem" width="4rem" class="rounded-full!" />
              </div>
              <Skeleton shape="circle" size="2.5rem" />
            </div>
            <Skeleton height="2rem" width="70%" />
          </template>

          <TournamentTabSkeleton :tab="tab" variant="mobile" />
        </div>
      </div>

      <!-- MobileBottomNav -->
      <div class="fixed bottom-0 left-0 right-0 bg-gray-800 flex items-center px-2 z-50 sk-nav-bar">
        <div v-for="i in 4" :key="i" class="flex-1 flex flex-col items-center gap-1">
          <Skeleton shape="circle" size="1.5rem" />
          <Skeleton height="0.5rem" width="2.5rem" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-6">
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center gap-3 mb-4">
            <Skeleton shape="circle" size="2.5rem" />
            <Skeleton height="2rem" width="40%" />
          </div>
          <Skeleton height="1rem" width="20%" class="mb-1" />
        </div>
      </div>
      <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto px-6">
          <Skeleton height="3rem" />
        </div>
      </div>
      <div class="max-w-6xl mx-auto px-6 py-6 min-h-[70vh]">
        <TournamentTabSkeleton :tab="tab" variant="desktop" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TournamentTabSkeleton from './TournamentTabSkeleton.vue'

const props = defineProps<{
  variant: 'mobile' | 'desktop'
  /** Route tab. Absent while the view is still resolving its default tab. */
  tab?: string
}>()

/** Same list as MOBILE_SUB_TABS in TournamentDetailView: these get the back bar. */
const MOBILE_SUB_TABS = ['teams', 'badges']

const isMobileSubPage = computed(
  () => props.variant === 'mobile' && MOBILE_SUB_TABS.includes(props.tab ?? ''),
)
</script>

<style scoped>
/* Same height contract as MobileBottomNav, so the placeholder nav sits exactly
   where the real one will. */
.sk-nav-bar {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(4rem + env(safe-area-inset-bottom));
}

/* A single brand sweep across the whole page, on top of PrimeVue's per-block
   pulse: it tells the eye the page is one thing loading, not eight. Purple taken
   from the splash lockup so the wait reads as ours. */
.sk-shimmer {
  position: relative;
  overflow: hidden;
}

.sk-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    100deg,
    transparent 35%,
    rgba(144, 74, 228, 0.14) 48%,
    rgba(228, 103, 255, 0.2) 52%,
    transparent 65%
  );
  transform: translateX(-100%);
  animation: sk-brand-sweep 2.2s ease-in-out infinite;
}

@keyframes sk-brand-sweep {
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk-shimmer::after {
    display: none;
  }
}
</style>
