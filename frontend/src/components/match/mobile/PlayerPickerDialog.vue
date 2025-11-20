<template>
  <Dialog
    v-model:visible="visible"
    modal
    :style="{ width: '100%', height: '100%', margin: 0, maxHeight: '100%' }"
    :pt="{
      root: { class: 'h-full w-full border-0 rounded-none' },
      header: { class: 'border-b p-4' },
      content: { class: 'p-0 h-full' },
      footer: { class: 'border-t p-4' },
    }"
    :showHeader="false"
  >
    <div class="flex flex-col h-full bg-white dark:bg-gray-900">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h3 class="text-lg font-semibold">{{ title }}</h3>
        <Button icon="fas fa-times" text rounded @click="close" />
      </div>

      <!-- Search -->
      <div class="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <span class="relative w-full">
          <i class="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <InputText
            v-model="searchQuery"
            placeholder="Rechercher un joueur..."
            class="w-full pl-10"
          />
        </span>
      </div>

      <!-- Player List -->
      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="filteredPlayers.length === 0" class="text-center p-8 text-gray-500">
          Aucun joueur trouvé
        </div>
        <div
          v-for="player in filteredPlayers"
          :key="player.id"
          class="flex items-center p-3 mb-2 rounded-lg active:bg-gray-100 dark:active:bg-gray-800 transition-colors cursor-pointer"
          :class="{
            'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800':
              isSelected(player.id),
          }"
          @click="togglePlayer(player.id)"
        >
          <Avatar
            :label="getInitials(player.displayName)"
            shape="circle"
            class="mr-3"
            :class="{ 'bg-blue-500 text-white': isSelected(player.id) }"
          />
          <div class="flex-1">
            <div class="font-medium">{{ player.displayName }}</div>
          </div>
          <div v-if="isSelected(player.id)" class="text-blue-600 dark:text-blue-400">
            <i class="fas fa-check-circle text-xl" />
          </div>
          <div v-else class="text-gray-300 dark:text-gray-600">
            <i class="far fa-circle text-xl" />
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-900">
        <Button label="Terminer" class="w-full" @click="close" />
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Player {
  id: string
  displayName: string
  avatarUrl?: string
}

interface Props {
  title?: string
  players: Player[]
  selectedIds: string[]
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Sélectionner des joueurs',
  players: () => [],
  selectedIds: () => [],
})

const emit = defineEmits<{
  'update:selectedIds': [ids: string[]]
  close: []
}>()

const visible = defineModel<boolean>('visible')
const searchQuery = ref('')

const filteredPlayers = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return props.players

  return props.players.filter((p) => p.displayName.toLowerCase().includes(query))
})

function isSelected(id: string) {
  return props.selectedIds.includes(id)
}

function togglePlayer(id: string) {
  const newIds = [...props.selectedIds]
  const index = newIds.indexOf(id)

  if (index === -1) {
    newIds.push(id)
  } else {
    newIds.splice(index, 1)
  }

  emit('update:selectedIds', newIds)
}

function close() {
  visible.value = false
  emit('close')
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
</script>
