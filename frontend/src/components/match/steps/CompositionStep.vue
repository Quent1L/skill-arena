<template>
  <div class="flex flex-col gap-6 pt-4">
    <h3 class="text-base font-semibold">Composition</h3>

    <p class="text-sm text-surface-500">Faites glisser les joueurs pour former les équipes.</p>

    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <div class="text-sm font-semibold">Équipe 1</div>
        <div
          class="relative min-h-20 rounded-lg border-2 border-dashed border-surface-300 dark:border-surface-600 p-3"
        >
          <span
            v-if="playersA.length === 0"
            class="absolute inset-0 flex items-center justify-center text-xs text-surface-400 pointer-events-none"
            >Vide</span
          >
          <VueDraggable
            v-model="playersA"
            tag="div"
            class="flex flex-col gap-2 min-h-14"
            :group="{ name: 'match-composition', pull: true, put: true }"
          >
            <div
              v-for="player in playersA"
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

      <div class="flex flex-col gap-2">
        <div class="text-sm font-semibold">Équipe 2</div>
        <div
          class="relative min-h-20 rounded-lg border-2 border-dashed border-surface-300 dark:border-surface-600 p-3"
        >
          <span
            v-if="playersB.length === 0"
            class="absolute inset-0 flex items-center justify-center text-xs text-surface-400 pointer-events-none"
            >Vide</span
          >
          <VueDraggable
            v-model="playersB"
            tag="div"
            class="flex flex-col gap-2 min-h-14"
            :group="{ name: 'match-composition', pull: true, put: true }"
          >
            <div
              v-for="player in playersB"
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
    </div>

    <div v-if="emptySide" class="text-sm text-red-500">
      Chaque équipe doit avoir au moins un joueur.
    </div>

    <div v-if="!hideNavigation" class="flex justify-between pt-2">
      <Button
        label="Précédent"
        severity="secondary"
        icon="fas fa-arrow-left"
        @click="emit('previous')"
      />
      <Button
        :label="props.nextLabel ?? 'Suivant'"
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
import { ref, computed, onMounted, watch, watchEffect } from 'vue'
import Button from 'primevue/button'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { MatchSideInput } from '@skill-arena/shared/types/index'

interface Player {
  id: string
  displayName: string
}

interface Props {
  playerNames: Record<string, string>
  hideNavigation?: boolean
  nextLabel?: string
}

interface Emits {
  (e: 'previous'): void
  (e: 'next'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const sidesModel = defineModel<MatchSideInput[]>('sides', { required: true })
const allPlayerIdsModel = defineModel<string[]>('allPlayerIds', { required: true })

const playersA = ref<Player[]>([])
const playersB = ref<Player[]>([])

function buildAndInit() {
  const existing = sidesModel.value.filter((s) => s.playerIds && s.playerIds.length > 0)

  if (existing.length >= 2) {
    playersA.value = existing[0].playerIds!.map((id) => ({
      id,
      displayName: props.playerNames[id] ?? id,
    }))
    playersB.value = existing[1].playerIds!.map((id) => ({
      id,
      displayName: props.playerNames[id] ?? id,
    }))
    return
  }

  const ids = allPlayerIdsModel.value
  const half = Math.ceil(ids.length / 2)
  playersA.value = ids
    .slice(0, half)
    .map((id) => ({ id, displayName: props.playerNames[id] ?? id }))
  playersB.value = ids.slice(half).map((id) => ({ id, displayName: props.playerNames[id] ?? id }))
}

function syncSidesToModel() {
  sidesModel.value = [
    { position: 1, playerIds: playersA.value.map((p) => p.id) },
    { position: 2, playerIds: playersB.value.map((p) => p.id) },
  ]
}

const emptySide = computed(() => playersA.value.length === 0 || playersB.value.length === 0)

defineExpose({ triggerNext: () => onNext() })

function onNext() {
  syncSidesToModel()
  emit('next')
}

watchEffect(syncSidesToModel)

watch(allPlayerIdsModel, () => {
  const idsSet = new Set(allPlayerIdsModel.value)
  playersA.value = playersA.value.filter((p) => idsSet.has(p.id))
  playersB.value = playersB.value.filter((p) => idsSet.has(p.id))

  const assignedIds = new Set([
    ...playersA.value.map((p) => p.id),
    ...playersB.value.map((p) => p.id),
  ])
  for (const id of allPlayerIdsModel.value) {
    if (!assignedIds.has(id)) {
      const player = { id, displayName: props.playerNames[id] ?? id }
      if (playersA.value.length <= playersB.value.length) {
        playersA.value = [...playersA.value, player]
      } else {
        playersB.value = [...playersB.value, player]
      }
      assignedIds.add(id)
    }
  }
})

watch(
  () => props.playerNames,
  (names) => {
    playersA.value = playersA.value.map((p) => ({ ...p, displayName: names[p.id] ?? p.id }))
    playersB.value = playersB.value.map((p) => ({ ...p, displayName: names[p.id] ?? p.id }))
  },
)

onMounted(buildAndInit)
</script>
