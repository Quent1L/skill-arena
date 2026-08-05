<template>
  <div class="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
    <i :class="[icon, accent]" class="w-4 text-center" />
    <div class="min-w-0 flex-1">
      <div class="text-[11px] uppercase tracking-wide text-gray-400">{{ label }}</div>
      <div class="truncate text-sm font-semibold">{{ relation.displayName }}</div>
    </div>
    <div class="shrink-0 text-right text-xs text-gray-400">
      <div class="text-sm font-bold text-white">{{ relation.wins }}-{{ relation.losses }}</div>
      {{ t('rewind.feats.matches', relation.count) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PlayerRelationStat } from '@skol-arena/shared/types/index'

defineProps<{
  label: string
  relation: PlayerRelationStat
  icon: string
  accent: string
}>()

const { t } = useI18n()
</script>
