<template>
  <template v-if="items.length > 0">
    <Button
      icon="fa fa-ellipsis-v"
      severity="secondary"
      outlined
      @click="menu!.toggle($event)"
      aria-haspopup="true"
      :aria-controls="menuId"
    />
    <Menu :id="menuId" ref="menu" :model="items" popup />
  </template>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'

interface Props {
  items: MenuItem[]
  menuId?: string
}

withDefaults(defineProps<Props>(), {
  menuId: 'overflow-menu',
})

const menu = ref<InstanceType<typeof Menu> | null>(null)
</script>
