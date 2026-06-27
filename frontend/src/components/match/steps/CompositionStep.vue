<template>
  <div class="flex flex-col gap-6 pt-4">
    <h3 class="text-base font-semibold">{{ t('compositionStep.title') }}</h3>

    <p class="text-sm text-surface-500">{{ t('compositionStep.instruction') }}</p>

    <div class="grid gap-4" :class="zones.length > 2 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'">
      <div v-for="(zone, idx) in zones" :key="zone.position" class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold">{{ t('compositionStep.camp', { number: idx + 1 }) }}</div>
          <button
            v-if="zones.length > 2"
            type="button"
            class="text-surface-400 hover:text-red-500 text-xs bg-transparent border-0 cursor-pointer"
            :title="t('compositionStep.removeCamp')"
            @click="removeZone(idx)"
          >
            <i class="fas fa-times" />
          </button>
        </div>
        <div
          class="relative min-h-20 rounded-lg border-2 border-dashed border-surface-300 dark:border-surface-600 p-3"
        >
          <span
            v-if="zone.players.length === 0"
            class="absolute inset-0 flex items-center justify-center text-xs text-surface-400 pointer-events-none"
            >{{ t('compositionStep.empty') }}</span
          >
          <VueDraggable
            v-model="zone.players"
            tag="div"
            class="flex flex-col gap-2 min-h-14"
            :group="{ name: 'match-composition', pull: true, put: true }"
            @end="syncSidesToModel"
          >
            <div
              v-for="player in zone.players"
              :key="player.id"
              class="flex items-center gap-2 rounded-md bg-surface-100 dark:bg-surface-800 px-3 py-2 cursor-grab select-none touch-none text-sm hover:bg-surface-200 dark:hover:bg-surface-700 hover:shadow-sm transition-colors duration-150"
              @contextmenu.prevent
            >
              <i class="fas fa-grip-vertical text-surface-400 text-xs" />
              <PlayerAvatar :name="player.displayName" size="xs" />
              {{ player.displayName }}
            </div>
          </VueDraggable>
        </div>
      </div>

      <!-- Add camp -->
      <button
        v-if="zones.length < maxSides"
        type="button"
        class="min-h-20 mt-6 rounded-lg border-2 border-dashed border-surface-300 dark:border-surface-600 flex flex-col items-center justify-center gap-1 text-surface-400 hover:text-primary hover:border-primary cursor-pointer bg-transparent transition-colors"
        @click="addZone"
      >
        <i class="fas fa-plus" />
        <span class="text-xs">{{ t('compositionStep.addCamp') }}</span>
      </button>
    </div>

    <div v-if="emptySide" class="text-sm text-red-500">
      {{ t('compositionStep.emptySideError') }}
    </div>

    <div v-if="!hideNavigation" class="flex justify-between pt-2">
      <Button
        :label="t('compositionStep.previous')"
        severity="secondary"
        icon="fas fa-arrow-left"
        @click="emit('previous')"
      />
      <Button
        :label="props.nextLabel ?? t('compositionStep.next')"
        :icon="props.nextLabel ? 'fas fa-calendar-check' : 'fas fa-arrow-right'"
        :icon-pos="props.nextLabel ? undefined : 'right'"
        :class="props.nextLabel ? 'bg-green-600 hover:bg-green-700' : ''"
        :disabled="emptySide"
        @click="onNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { MatchSideInput } from '@skol-arena/shared/types/index'

interface Player {
  id: string
  displayName: string
}

interface Zone {
  position: number
  players: Player[]
}

interface Props {
  playerNames: Record<string, string>
  maxSides?: number
  hideNavigation?: boolean
  nextLabel?: string
}

interface Emits {
  (e: 'previous'): void
  (e: 'next'): void
}

const props = withDefaults(defineProps<Props>(), { maxSides: 2 })
const emit = defineEmits<Emits>()
const { t } = useI18n()

const sidesModel = defineModel<MatchSideInput[]>('sides', { required: true })
const allPlayerIdsModel = defineModel<string[]>('allPlayerIds', { required: true })

const zones = ref<Zone[]>([])

function toPlayer(id: string): Player {
  return { id, displayName: props.playerNames[id] ?? id }
}

function buildAndInit() {
  const existing = sidesModel.value.filter((s) => s.playerIds && s.playerIds.length > 0)

  if (existing.length >= 2) {
    zones.value = existing.map((s, i) => ({
      position: i + 1,
      players: (s.playerIds ?? []).map(toPlayer),
    }))
    return
  }

  // Default: split players into 2 zones (user can add more up to maxSides).
  const ids = allPlayerIdsModel.value
  const half = Math.ceil(ids.length / 2)
  zones.value = [
    { position: 1, players: ids.slice(0, half).map(toPlayer) },
    { position: 2, players: ids.slice(half).map(toPlayer) },
  ]
}

function syncSidesToModel() {
  sidesModel.value = zones.value.map((z, i) => ({
    position: i + 1,
    playerIds: z.players.map((p) => p.id),
  }))
}

function addZone() {
  if (zones.value.length >= props.maxSides) return
  zones.value.push({ position: zones.value.length + 1, players: [] })
  syncSidesToModel()
}

function removeZone(idx: number) {
  if (zones.value.length <= 2) return
  const [removed] = zones.value.splice(idx, 1)
  // Move orphaned players to the first zone so nobody is lost.
  if (removed.players.length > 0) zones.value[0].players.push(...removed.players)
  zones.value.forEach((z, i) => (z.position = i + 1))
  syncSidesToModel()
}

const emptySide = computed(() => zones.value.some((z) => z.players.length === 0))

defineExpose({ triggerNext: () => onNext() })

function onNext() {
  syncSidesToModel()
  emit('next')
}

watch(allPlayerIdsModel, () => {
  const idsSet = new Set(allPlayerIdsModel.value)
  for (const zone of zones.value) {
    zone.players = zone.players.filter((p) => idsSet.has(p.id))
  }
  const assigned = new Set(zones.value.flatMap((z) => z.players.map((p) => p.id)))
  for (const id of allPlayerIdsModel.value) {
    if (assigned.has(id)) continue
    const smallest = zones.value.reduce((a, b) => (a.players.length <= b.players.length ? a : b))
    smallest.players.push(toPlayer(id))
    assigned.add(id)
  }
  syncSidesToModel()
})

watch(
  () => props.playerNames,
  (names) => {
    for (const zone of zones.value) {
      zone.players = zone.players.map((p) => ({ ...p, displayName: names[p.id] ?? p.id }))
    }
  },
)

onMounted(() => {
  buildAndInit()
  syncSidesToModel()
})
</script>
