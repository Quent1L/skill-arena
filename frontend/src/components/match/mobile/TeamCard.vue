<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
  >
    <div
      class="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50"
    >
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
      <Badge :value="selectedIds.length" severity="info" />
    </div>

    <div class="p-4">
      <div v-if="selectedIds.length > 0" class="flex flex-wrap gap-2 mb-4">
        <Chip
          v-for="id in selectedIds"
          :key="id"
          :label="getPlayerName(id)"
          removable
          @remove="removePlayer(id)"
          class="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0"
        />
      </div>
      <div v-else class="text-sm text-gray-500 italic mb-4 text-center py-2">
        Aucun joueur sélectionné
      </div>

      <Button
        label="Gérer les joueurs"
        icon="fas fa-users-cog"
        outlined
        class="w-full"
        @click="openPicker"
      />
    </div>

    <PlayerPickerDialog
      v-model:visible="pickerVisible"
      :title="`Joueurs - ${title}`"
      :players="allPlayers"
      :selected-ids="selectedIds"
      @update:selected-ids="updateSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PlayerPickerDialog from './PlayerPickerDialog.vue'

interface Player {
  id: string
  displayName: string
}

interface Props {
  title: string
  selectedIds: string[]
  allPlayers: Player[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:selectedIds': [ids: string[]]
  validate: []
}>()

const pickerVisible = ref(false)

function openPicker() {
  pickerVisible.value = true
}

function updateSelection(ids: string[]) {
  emit('update:selectedIds', ids)
  emit('validate')
}

function removePlayer(id: string) {
  const newIds = props.selectedIds.filter((pid) => pid !== id)
  emit('update:selectedIds', newIds)
  emit('validate')
}

function getPlayerName(id: string) {
  const player = props.allPlayers.find((p) => p.id === id)
  return player ? player.displayName : 'Inconnu'
}
</script>
