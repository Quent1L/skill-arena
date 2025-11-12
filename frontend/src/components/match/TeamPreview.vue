<template>
  <div class="flex flex-col md:flex-row items-center md:items-stretch md:justify-between gap-4">
    <div class="w-full md:w-1/2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm animate-fade-in">
      <h4 class="text-sm font-semibold mb-2">Équipe A</h4>
      <ul class="text-sm space-y-1">
        <li v-if="teamAPlayers.length === 0" class="text-gray-500">Aucun joueur sélectionné</li>
        <li v-for="(p, idx) in teamAPlayers" :key="`a-${idx}`">{{ p }}</li>
      </ul>
    </div>

    <div class="w-full md:w-1/2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm animate-fade-in">
      <h4 class="text-sm font-semibold mb-2">Équipe B</h4>
      <ul class="text-sm space-y-1">
        <li v-if="teamBPlayers.length === 0" class="text-gray-500">Aucun joueur sélectionné</li>
        <li v-for="(p, idx) in teamBPlayers" :key="`b-${idx}`">{{ p }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  teamAPlayers: string[]
  teamBPlayers: string[]
}

defineProps<Props>()
</script>
