<template>
  <div
    class="flex items-center gap-3 rounded-2xl px-4 py-2.5"
    :class="isMine ? 'bg-amber-500/10 ring-1 ring-amber-400/40' : 'bg-white/5'"
  >
    <i :class="icon" class="w-5 text-center text-base" :style="{ color: accent }" />
    <div class="min-w-0 flex-1">
      <div class="truncate text-xs uppercase tracking-wide text-gray-300">{{ label }}</div>
      <div class="truncate text-sm font-semibold">{{ playerName }}</div>
    </div>
    <div class="shrink-0 text-right">
      <div class="text-base font-black tabular-nums" :style="{ color: accent }">
        {{ prefix }}{{ value }}{{ suffix }}
      </div>
      <div v-if="detail" class="text-xs text-gray-400">{{ detail }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    playerName: string
    value: number | string
    icon: string
    accent: string
    detail?: string
    prefix?: string
    suffix?: string
    isMine?: boolean
  }>(),
  { prefix: '', suffix: '', isMine: false },
)
</script>
