<template>
  <div class="condition-palette">
    <p class="text-xs font-semibold text-surface-500 mb-2">Blocs (glisser-déposer)</p>
    <VueDraggable
      v-model="items"
      :group="{ name: 'cond', pull: 'clone', put: false }"
      :sort="false"
      :clone="cloneNode"
      class="flex flex-col gap-2"
    >
      <div
        v-for="item in items"
        :key="item.paletteType"
        class="flex items-center gap-2 px-3 py-2 rounded cursor-grab select-none text-sm bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700"
      >
        <i class="fa fa-grip-vertical text-surface-400"></i>
        {{ item.label }}
      </div>
    </VueDraggable>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { PALETTE_ITEMS, nodeFromPalette, type BuilderNode, type PaletteItem } from './condition-tree'

const items = ref<PaletteItem[]>([...PALETTE_ITEMS])

function cloneNode(item: PaletteItem): BuilderNode {
  return nodeFromPalette(item)
}
</script>
