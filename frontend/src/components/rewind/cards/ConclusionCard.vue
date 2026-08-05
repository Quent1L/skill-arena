<template>
  <RewindCardShell
    :eyebrow="t('rewind.conclusion.eyebrow')"
    :title="t('rewind.conclusion.title')"
    :subtitle="t('rewind.conclusion.subtitle')"
  >
    <div class="flex flex-col items-center gap-5">
      <div class="relative flex h-24 w-24 items-center justify-center">
        <div class="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl" />
        <i class="fa fa-hand-peace relative text-5xl text-indigo-300" />
      </div>

      <div
        v-if="nextSeason"
        class="flex w-full flex-col items-center gap-3 rounded-2xl bg-white/5 px-4 py-5"
      >
        <span class="text-xs uppercase tracking-wide text-gray-400">
          {{ t('rewind.conclusion.nextSeason') }}
        </span>
        <span class="text-lg font-bold">{{ nextSeason.name }}</span>
        <span class="text-sm text-gray-400">
          {{ t('rewind.conclusion.startsOn', { date: startDate }) }}
        </span>
        <!-- z-30 keeps this above the deck's mobile tap zones (z-20). -->
        <button
          class="relative z-30 w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold transition-colors hover:bg-indigo-400"
          @click="$emit('join', nextSeason.id)"
        >
          {{ t('rewind.conclusion.join') }}
        </button>
      </div>

      <p v-else class="text-center text-sm text-gray-400">
        {{ t('rewind.conclusion.noNextSeason') }}
      </p>
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload } from '@skol-arena/shared/types/index'
import { formatRewindDate } from '@/composables/ranked/rewind.service'
import RewindCardShell from '../RewindCardShell.vue'

const props = defineProps<{ player: PlayerRewindPayload | null }>()
defineEmits<{ (e: 'join', seasonId: string): void }>()

const { t, locale } = useI18n()

const nextSeason = computed(() => props.player?.conclusion.nextSeason ?? null)
const startDate = computed(() =>
  nextSeason.value ? formatRewindDate(nextSeason.value.startDate, locale.value) : '',
)
</script>
