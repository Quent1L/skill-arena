<template>
  <div class="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
    <div class="flex-1">
      <div class="flex justify-between">
        <div class="flex items-center gap-3 mb-4">
          <Badge :value="statusLabels[status]" :severity="statusSeverities[status]" />
          <Badge :value="modeLabels[mode]" severity="info" class="bg-blue-100 text-blue-800" />
        </div>

        <div class="flex items-center gap-3">
          <Button
            v-if="isAuthenticated && !isParticipant && canJoin"
            label="Participer"
            icon="fa fa-user-plus"
            @click="$emit('join')"
            :loading="joining"
            class="bg-green-600 hover:bg-green-700"
          />

          <div
            v-if="isAuthenticated && isParticipant && !canLeave"
            class="flex items-center gap-2 text-green-600"
          >
            <i class="fa fa-check-circle"></i>
            <span class="font-medium">Déjà inscrit</span>
          </div>

          <Button
            v-if="canCreateMatch"
            label="Créer un match"
            icon="fa fa-plus"
            @click="emit('create-match')"
            class="bg-blue-600 hover:bg-blue-700 hidden md:flex"
          />
          <Button
            v-if="rulesId"
            icon="fa fa-scroll"
            v-tooltip.top="'Règles'"
            severity="secondary"
            outlined
            @click="emit('view-rules')"
          ></Button>

          <Button
            v-if="menuItems.length > 0"
            icon="fa fa-ellipsis-v"
            severity="secondary"
            outlined
            @click="menu!.toggle($event)"
            aria-haspopup="true"
            aria-controls="header-menu"
          />
          <Menu id="header-menu" ref="menu" :model="menuItems" popup />
        </div>
      </div>

      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {{ name }}
      </h1>

      <p v-if="description" class="text-gray-600 dark:text-gray-400">
        {{ description }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'
import type Menu from 'primevue/menu'
import type { TournamentStatus, TournamentMode } from '@skill-arena/shared'

interface Props {
  name: string
  description?: string
  status: TournamentStatus
  mode: TournamentMode
  isAuthenticated: boolean
  isParticipant: boolean
  canJoin: boolean
  canLeave: boolean
  canCreateMatch: boolean
  canManage: boolean
  joining?: boolean
  leaving?: boolean
  rulesId?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  join: []
  leave: []
  'create-match': []
  edit: []
  'view-rules': []
}>()

const menu = ref<InstanceType<typeof Menu> | null>(null)

const breakpoints = useBreakpoints(breakpointsTailwind)
const isDesktop = breakpoints.greaterOrEqual('sm')

const menuItems = computed(() => {
  const items = []

  if (props.canManage) {
    items.push({ label: 'Modifier', icon: 'fa fa-pencil', command: () => emit('edit') })
  }
  if (props.isAuthenticated && props.isParticipant && props.canLeave) {
    items.push({ label: 'Quitter', icon: 'fa fa-user-minus', command: () => emit('leave') })
  }

  return items
})

const statusLabels: Record<TournamentStatus, string> = {
  draft: 'Brouillon',
  open: 'Ouvert',
  ongoing: 'En cours',
  finished: 'Terminé',
}

const statusSeverities: Record<TournamentStatus, 'secondary' | 'success' | 'warn' | 'info'> = {
  draft: 'secondary',
  open: 'success',
  ongoing: 'warn',
  finished: 'info',
}

const modeLabels: Record<TournamentMode, string> = {
  championship: 'Championnat',
  bracket: 'Bracket',
}
</script>
