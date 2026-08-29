<template>
  <!-- Infos: the navigation cards, then the description block. -->
  <div v-if="kind === 'infos'" class="space-y-4 sm:space-y-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <div
        v-for="i in 3"
        :key="i"
        class="flex items-center justify-between p-4 sm:p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800"
      >
        <div class="flex items-center gap-3">
          <Skeleton width="2.5rem" height="2.5rem" class="rounded-lg!" />
          <div class="space-y-1.5">
            <Skeleton height="0.9rem" width="7rem" />
            <Skeleton height="0.7rem" width="10rem" />
          </div>
        </div>
        <Skeleton width="0.6rem" height="0.9rem" />
      </div>
    </div>
    <div
      class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-2"
    >
      <Skeleton height="0.85rem" />
      <Skeleton height="0.85rem" />
      <Skeleton height="0.85rem" width="60%" />
    </div>
  </div>

  <!-- Matches: the filter chips, then the card grid. -->
  <div v-else-if="kind === 'matches'">
    <div class="mb-4 flex gap-2">
      <Skeleton v-for="i in 3" :key="i" height="2rem" width="6rem" class="rounded-full!" />
    </div>
    <div :class="gridClass">
      <div
        v-for="i in cardCount"
        :key="i"
        class="rounded-xl bg-surface-800 border border-surface-700/10 px-3 pt-2.5 pb-2 space-y-3"
      >
        <div class="flex items-center justify-between">
          <Skeleton height="0.7rem" width="4rem" />
          <Skeleton height="0.7rem" width="3rem" />
        </div>
        <div class="flex items-center gap-2 pt-1">
          <div class="flex-1 flex flex-col items-center gap-1.5">
            <Skeleton shape="circle" size="2rem" />
            <Skeleton height="0.7rem" width="4rem" />
          </div>
          <Skeleton height="1.6rem" width="3rem" />
          <div class="flex-1 flex flex-col items-center gap-1.5">
            <Skeleton shape="circle" size="2rem" />
            <Skeleton height="0.7rem" width="4rem" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Standings: tier bands, each holding a few player rows. The same shape carries
       the ranked tier list and the championship table closely enough that the layout
       does not jump whichever one lands. -->
  <div v-else-if="kind === 'standings'" class="space-y-3">
    <div
      v-for="group in 2"
      :key="group"
      class="rounded-2xl overflow-hidden bg-surface-800 border border-surface-700/10"
    >
      <div class="flex items-center gap-3 px-4 py-3">
        <Skeleton shape="circle" size="2rem" />
        <Skeleton height="1rem" width="7rem" />
      </div>
      <div
        v-for="row in 3"
        :key="row"
        class="flex items-center gap-3 px-4 py-2.5 border-t border-white/5"
      >
        <Skeleton width="1.2rem" height="1rem" />
        <Skeleton shape="circle" size="1.75rem" />
        <Skeleton height="0.9rem" width="40%" />
        <div class="flex-1" />
        <Skeleton height="0.9rem" width="2.5rem" />
      </div>
    </div>
  </div>

  <!-- Participants / teams / badges: a flat list of rows. -->
  <div v-else-if="kind === 'list'" class="space-y-2">
    <div
      v-for="i in 6"
      :key="i"
      class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800"
    >
      <Skeleton shape="circle" size="2.25rem" />
      <div class="space-y-1.5 flex-1">
        <Skeleton height="0.9rem" width="45%" />
        <Skeleton height="0.7rem" width="25%" />
      </div>
      <Skeleton height="1.5rem" width="3rem" class="rounded-full!" />
    </div>
  </div>

  <!-- Stats: the sub-tab switch, then the chart cards. -->
  <div v-else-if="kind === 'stats'" class="space-y-4">
    <div class="flex gap-2">
      <Skeleton height="2rem" width="8rem" class="rounded-full!" />
      <Skeleton height="2rem" width="8rem" class="rounded-full!" />
    </div>
    <div :class="gridClass">
      <Skeleton v-for="i in cardCount" :key="i" height="11rem" class="rounded-xl!" />
    </div>
  </div>

  <!-- Bracket: rounds of match boxes, spaced as columns. -->
  <div v-else class="flex gap-4 overflow-hidden">
    <div v-for="round in 3" :key="round" class="flex-1 flex flex-col justify-around gap-4 min-w-32">
      <Skeleton
        v-for="box in 4 - round"
        :key="box"
        height="4.5rem"
        class="rounded-xl!"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * The body of a tournament tab while it loads. Each shape mirrors what that tab
 * actually renders, so the page settles instead of being rebuilt when the data lands.
 */
const props = defineProps<{
  /** Route tab. Absent while the view is still resolving its default tab. */
  tab?: string
  variant: 'mobile' | 'desktop'
}>()

type Kind = 'infos' | 'matches' | 'standings' | 'list' | 'stats' | 'bracket'

const KINDS: Record<string, Kind> = {
  infos: 'infos',
  matches: 'matches',
  standings: 'standings',
  participants: 'list',
  teams: 'list',
  badges: 'list',
  stats: 'stats',
  bracket: 'bracket',
}

// No tab in the URL means the view is about to redirect to the mode's default one,
// which is standings for every mode but bracket — so that is what to draw.
const kind = computed<Kind>(() => KINDS[props.tab ?? ''] ?? 'standings')

const cardCount = computed(() => (props.variant === 'mobile' ? 3 : 6))

const gridClass = computed(() =>
  props.variant === 'mobile' ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-4',
)
</script>
