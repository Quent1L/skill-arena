<template>
  <div v-if="showHeader" class="px-4 sm:px-6 lg:px-8 py-4">
    <div class="flex items-center gap-3 flex-wrap">
      <Button
        v-if="home"
        :icon="home.icon"
        text
        rounded
        size="small"
        @click="() => home?.command?.()"
        class="text-muted-color hover:text-color"
      />
      
      <template v-for="(item, index) in allItems" :key="index">
        <i v-if="index > 0" class="fas fa-chevron-right text-sm text-muted-color"></i>
        
        <Button
          v-if="item.command && !item.isTitle"
          :label="item.label as string"
          text
          size="small"
          @click="() => item.command?.()"
          class="text-muted-color hover:text-color"
        />
        
        <h1 v-else-if="item.isTitle" class="text-3xl font-bold m-0">
          {{ item.label }}
        </h1>
        
        <span v-else class="text-muted-color">
          {{ item.label }}
        </span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface BreadcrumbItem {
  label: string
  command?: () => void
  isTitle?: boolean
}

const route = useRoute()
const router = useRouter()

const home = computed<{ icon: string; command: () => void } | null>(() => {
  if (route.meta.hideBreadcrumb && !route.meta.title) {
    return null
  }
  
  return {
    icon: 'fas fa-home',
    command: () => {
      router.push('/')
    },
  }
})

const showHeader = computed(() => {
  return !route.meta.hideBreadcrumb || route.meta.title
})

const allItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = []
  
  if (route.meta.parent) {
    const parentRoute = router.getRoutes().find(r => r.name === route.meta.parent)
    if (parentRoute && parentRoute.meta?.breadcrumb) {
      items.push({
        label: parentRoute.meta.breadcrumb as string,
        command: () => {
          router.push({ name: parentRoute.name as string })
        },
      })
    }
  }
  
  if (route.meta.title) {
    items.push({
      label: route.meta.title as string,
      isTitle: true,
    })
  } else if (route.meta.breadcrumb && !route.meta.hideBreadcrumb) {
    items.push({
      label: route.meta.breadcrumb as string,
      isTitle: true,
    })
  }
  
  return items
})
</script>
