<template>
  <div class="p-8 flex gap-8">
    <div>
      <p class="mb-2 font-semibold">Liste A ({{ files1.length }})</p>
      <ul
        ref="ulA"
        class="flex flex-col gap-1 min-h-32 border-2 border-dashed border-blue-400 p-2 rounded w-48"
      >
        <li
          v-for="file in files1"
          :key="file"
          class="bg-blue-100 dark:bg-blue-900 px-3 py-2 rounded cursor-grab select-none text-sm"
        >
          {{ file }}
        </li>
      </ul>
    </div>

    <div>
      <p class="mb-2 font-semibold">Liste B ({{ files2.length }})</p>
      <ul
        ref="ulB"
        class="flex flex-col gap-1 min-h-32 border-2 border-dashed border-green-400 p-2 rounded w-48"
      >
        <li
          v-for="file in files2"
          :key="file"
          class="bg-green-100 dark:bg-green-900 px-3 py-2 rounded cursor-grab select-none text-sm"
        >
          {{ file }}
        </li>
      </ul>
    </div>

    <div class="text-xs text-surface-400 self-start pt-8 space-y-1">
      <div>A: {{ files1.join(', ') || '—' }}</div>
      <div>B: {{ files2.join(', ') || '—' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dragAndDrop } from '@formkit/drag-and-drop/vue'

const ulA = ref<HTMLElement>()
const ulB = ref<HTMLElement>()

const files1 = ref([
  'dungeon_master.exe',
  'map_1.dat',
  'map_2.dat',
  'character1.txt',
  'character2.txt',
  'shell32.dll',
  'README.txt',
])
const files2 = ref<string[]>([])

onMounted(() => {
  dragAndDrop([
    { parent: ulA, values: files1, group: 'A' },
    { parent: ulB, values: files2, group: 'A' },
  ])
})
</script>
