<template>
  <div class="flex items-center" :class="players.length > 1 ? '-space-x-2' : ''">
    <PlayerAvatar
      v-for="(player, idx) in players"
      :key="player.id"
      :name="player.displayName"
      :color-key="player.shortName"
      :size="size"
      :style="{ zIndex: 30 - idx * 10 }"
    />
  </div>
</template>

<script setup lang="ts">
import PlayerAvatar from '@/components/PlayerAvatar.vue'

defineProps<{
  players: { id: string; displayName: string; shortName: string }[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
}>()
</script>
