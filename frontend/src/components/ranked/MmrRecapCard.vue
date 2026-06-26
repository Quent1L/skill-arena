<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/85">
      <div
        class="w-full max-w-sm rounded-3xl sm:rounded-3xl bg-gray-900 text-white shadow-2xl overflow-hidden"
      >
        <!-- Header -->
        <div class="flex justify-center pt-5 pb-2">
          <span
            class="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-gray-700 text-gray-300"
          >
            {{ t('mmrRecapCard.title') }}
          </span>
        </div>

        <!-- Net total -->
        <div class="flex flex-col items-center py-4 px-6">
          <div
            class="text-4xl font-black font-mono"
            :class="netDelta >= 0 ? 'text-emerald-400' : 'text-red-400'"
          >
            {{ netDelta >= 0 ? '+' : '' }}{{ netDelta }}
          </div>
          <div class="text-gray-400 text-sm mt-1">
            {{ summaryText }}
          </div>
        </div>

        <!-- Per-match breakdown -->
        <div
          class="mx-6 mb-4 rounded-xl bg-gray-800 divide-y divide-gray-700 max-h-48 overflow-y-auto"
        >
          <div
            v-for="event in events"
            :key="event.id"
            class="flex items-center justify-between px-4 py-2.5 text-sm gap-2"
          >
            <div class="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              <!-- Teams: [teammates] vs [opponents] -->
              <div class="flex items-center gap-1.5">
                <PlayerAvatarStack
                  v-if="(event.teammates ?? []).length > 0"
                  :players="event.teammates ?? []"
                  size="xs"
                />
                <span class="text-gray-500 text-xs font-medium">vs</span>
                <PlayerAvatarStack :players="event.opponents ?? []" size="xs" />
              </div>
              <!-- Rank change / recalc badges -->
            </div>
            <div class="flex flex-wrap flex-col gap-1.5">
              <div
                v-if="event.rankChanged"
                class="text-xs shrink-0"
                :class="
                  (event.tierAfterLevel ?? 0) > (event.tierBeforeLevel ?? 0)
                    ? 'text-amber-400'
                    : 'text-sky-300'
                "
              >
                {{ (event.tierAfterLevel ?? 0) > (event.tierBeforeLevel ?? 0) ? '↑' : '↓' }}
                {{ event.tierAfterName }}
              </div>
              <div v-if="event.reason === 'recalculated'" class="text-sky-400 text-xs shrink-0">
                <i class="fa-solid fa-rotate"></i> {{ t('mmrRecapCard.recalculated') }}
              </div>
            </div>
            <!-- Date -->
            <div v-if="event.playedAt" class="text-gray-500 text-xs shrink-0">
              {{ formatMatchDate(event.playedAt) }}
            </div>
            <!-- Delta -->
            <span
              class="font-bold font-mono shrink-0"
              :class="event.mmrDelta >= 0 ? 'text-emerald-400' : 'text-red-400'"
            >
              {{ event.mmrDelta >= 0 ? '+' : '' }}{{ event.mmrDelta }}
            </span>
          </div>
        </div>

        <!-- Dismiss -->
        <div class="px-6 pb-6">
          <button
            class="w-full py-3 rounded-xl font-semibold text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
            @click="$emit('close')"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'
import type { MmrAnimationEventResponse } from '@skill-arena/shared'
import PlayerAvatarStack from '@/components/PlayerAvatarStack.vue'

const { t } = useI18n()

const props = defineProps<{
  events: MmrAnimationEventResponse[]
}>()

defineEmits<{ (e: 'close'): void }>()

const netDelta = computed(() => props.events.reduce((acc, e) => acc + e.mmrDelta, 0))
const recalcCount = computed(() => props.events.filter((e) => e.reason === 'recalculated').length)
const newCount = computed(() => props.events.length - recalcCount.value)

const newMatchesText = computed(() =>
  newCount.value > 1
    ? t('mmrRecapCard.newMatchesPlural', { count: newCount.value })
    : t('mmrRecapCard.newMatchesSingular', { count: newCount.value }),
)

const recalcMatchesText = computed(() =>
  recalcCount.value > 1
    ? t('mmrRecapCard.recalcMatchesPlural', { count: recalcCount.value })
    : t('mmrRecapCard.recalcMatchesSingular', { count: recalcCount.value }),
)

const summaryText = computed(() => {
  if (newCount.value > 0 && recalcCount.value > 0) {
    return `${newMatchesText.value}, ${recalcMatchesText.value}`
  }
  if (recalcCount.value > 0) {
    return recalcMatchesText.value
  }
  return newMatchesText.value
})

function formatMatchDate(date: Date) {
  return format(date, 'dd/MM HH:mm')
}
</script>
