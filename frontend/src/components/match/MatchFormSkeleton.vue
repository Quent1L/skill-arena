<template>
  <!-- Mirrors the wizard chrome, down to the step track and the action bar, so the
       form settles rather than being rebuilt when the data lands. The body is drawn
       as the `when` step: it is always the one the wizard opens on. -->
  <div class="sk-shimmer">
    <template v-if="variant === 'mobile'">
      <div class="flex flex-col h-screen bg-surface-50 dark:bg-surface-900">
        <!-- Sticky header -->
        <div
          class="sticky top-0 z-10 bg-surface-0 dark:bg-surface-800 border-b dark:border-surface-700 px-4 py-3 flex items-center gap-2 shadow-sm"
        >
          <Skeleton shape="circle" size="2.5rem" />
          <Skeleton height="1.25rem" width="9rem" />
        </div>

        <!-- Step progress indicator -->
        <div
          class="px-4 pt-3 pb-2 bg-surface-0 dark:bg-surface-800 border-b dark:border-surface-700"
        >
          <div class="flex items-center">
            <template v-for="(step, idx) in STEP_COUNT_RANGE" :key="step">
              <Skeleton shape="circle" size="2.25rem" class="flex-none!" />
              <div v-if="idx < STEP_COUNT - 1" class="flex-1 px-1">
                <Skeleton height="0.125rem" />
              </div>
            </template>
          </div>
        </div>

        <!-- Step body -->
        <div class="flex-1 overflow-y-auto px-4 pb-28">
          <div class="mt-4 flex flex-col gap-6 pt-4">
            <Skeleton height="1.25rem" width="7rem" />
            <div class="flex flex-col gap-2">
              <Skeleton height="1rem" width="5rem" />
              <Skeleton height="2.75rem" />
            </div>
            <div class="flex flex-col gap-2">
              <Skeleton height="1rem" width="6rem" />
              <Skeleton height="2.75rem" />
            </div>
          </div>
        </div>

        <!-- Fixed bottom action bar -->
        <div
          class="sk-action-bar fixed bottom-0 left-0 right-0 px-4 py-3 bg-surface-0 dark:bg-surface-800 border-t dark:border-surface-700"
        >
          <Skeleton height="2.75rem" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="max-w-2xl mx-auto p-4 sm:p-6">
        <Skeleton height="2rem" width="14rem" class="mb-6" />

        <div
          class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-6"
        >
          <!-- Step progress indicator -->
          <div class="flex items-center mb-6">
            <template v-for="(step, idx) in STEP_COUNT_RANGE" :key="step">
              <Skeleton shape="circle" size="2.5rem" class="flex-none!" />
              <div v-if="idx < STEP_COUNT - 1" class="flex-1 px-1">
                <Skeleton height="0.125rem" />
              </div>
            </template>
          </div>

          <!-- Step body -->
          <div class="flex flex-col gap-6 pt-4">
            <Skeleton height="1.25rem" width="7rem" />
            <div class="flex flex-col gap-2">
              <Skeleton height="1rem" width="5rem" />
              <Skeleton height="2.75rem" />
            </div>
            <div class="flex flex-col gap-2">
              <Skeleton height="1rem" width="6rem" />
              <Skeleton height="2.75rem" />
            </div>

            <div class="flex justify-end pt-2">
              <Skeleton height="2.75rem" width="8rem" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  variant: 'mobile' | 'desktop'
}>()

/**
 * The shortest wizard — when, participants (or teams), result. The real track can
 * grow a `composition` step, but that only happens once a line-up exists, which is
 * long after the data has landed.
 */
const STEP_COUNT = 3
const STEP_COUNT_RANGE = Array.from({ length: STEP_COUNT }, (_, i) => i)
</script>

<style scoped>
/* Same height contract as the real action bar, so the placeholder sits exactly
   where the buttons will. */
.sk-action-bar {
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
}
</style>
