<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/85">
      <div class="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-gray-900 text-white shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="flex justify-center pt-5 pb-2">
          <span class="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-gray-700 text-gray-300">
            Récap MMR
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
            depuis votre dernière visite ({{ events.length }} match{{ events.length > 1 ? 's' : '' }})
          </div>
        </div>

        <!-- Per-match breakdown -->
        <div class="mx-6 mb-4 rounded-xl bg-gray-800 divide-y divide-gray-700 max-h-48 overflow-y-auto">
          <div
            v-for="event in events"
            :key="event.id"
            class="flex items-center justify-between px-4 py-2.5 text-sm"
          >
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <PlayerAvatar
                  v-for="opp in event.opponents ?? []"
                  :key="opp.id"
                  :name="opp.displayName"
                  :color-key="opp.id"
                  size="xs"
                />
              </div>
              <span v-if="event.rankChanged && event.eventType === 'official'" class="text-amber-400 text-xs">
                ↑ {{ event.tierAfterName }}
              </span>
            </div>
            <span
              class="font-bold font-mono"
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
            Fermer
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MmrAnimationEventResponse } from '@skill-arena/shared'
import PlayerAvatar from '@/components/PlayerAvatar.vue'

const props = defineProps<{
  events: MmrAnimationEventResponse[]
}>()

defineEmits<{ (e: 'close'): void }>()

const netDelta = computed(() => props.events.reduce((acc, e) => acc + e.mmrDelta, 0))
</script>
