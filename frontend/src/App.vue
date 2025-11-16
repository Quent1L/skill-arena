<template>
  <div>
    <Toast position="top-right" />
    <ConfirmDialog />
    <AnimatedWraper v-if="!isAuthenticated" class="bg-gray-800" />
    <AppWrapper v-else />
  </div>
</template>

<script setup lang="ts">
import { useAuth } from './composables/useAuth'
import AppWrapper from './AppWrapper.vue'
import AnimatedWraper from './AnimatedWraper.vue'


const { isAuthenticated } = useAuth()
</script>
