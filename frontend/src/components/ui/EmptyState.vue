<template>
  <div class="flex flex-col items-center px-4 py-10 text-center">
    <i :class="icon" class="mb-4 block text-4xl text-gray-500 opacity-30" aria-hidden="true" />
    <h3 class="text-base font-semibold text-gray-300">{{ title }}</h3>
    <p v-if="message" class="mt-1 max-w-sm text-sm text-muted-color">{{ message }}</p>
    <Button
      v-if="actionLabel"
      :label="actionLabel"
      :icon="actionIcon"
      text
      size="small"
      class="mt-3"
      @click="emit('action')"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  message?: string
  actionLabel?: string
  actionIcon?: string
}>()

const emit = defineEmits<{ action: [] }>()
</script>
