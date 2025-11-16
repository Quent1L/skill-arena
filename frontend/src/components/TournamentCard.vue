<template>
  <Card
    class="tournament-card cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 h-full"
    @click="$emit('click', tournament)"
  >
    <template #header>
      <div class="relative">
        <div class="h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-t-lg">
          <div class="absolute top-3 right-3">
            <Badge :value="statusLabel" :severity="statusSeverity" />
          </div>
        </div>
      </div>
    </template>

    <template #content>
      <div class="space-y-4">
        <!-- Titre et description -->
        <div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {{ tournament.name }}
          </h3>
          <p
            v-if="tournament.description"
            class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2"
          >
            {{ tournament.description }}
          </p>
        </div>

        <!-- Informations principales -->
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500 dark:text-gray-400 font-medium">Mode:</span>
            <div class="flex items-center gap-2">
              <i :class="modeIcon" class="text-blue-600"></i>
              <span class="font-semibold">{{ modeLabel }}</span>
            </div>
          </div>

          <div>
            <span class="text-gray-500 dark:text-gray-400 font-medium">Équipe:</span>
            <div class="font-semibold">
              {{
                tournament.minTeamSize === tournament.maxTeamSize
                  ? `${tournament.minTeamSize} joueurs`
                  : `${tournament.minTeamSize}-${tournament.maxTeamSize} joueurs`
              }}
            </div>
          </div>
        </div>

        <!-- Dates -->
        <div class="border-t pt-3">
          <div class="flex justify-between items-center text-sm">
            <div>
              <span class="text-gray-500 dark:text-gray-400">Début:</span>
              <span class="font-medium ml-1">{{ formatDate(tournament.startDate) }}</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Fin:</span>
              <span class="font-medium ml-1">{{ formatDate(tournament.endDate) }}</span>
            </div>
          </div>
        </div>

        <!-- Statistiques (si disponible) -->
        <div
          v-if="showStats && hasTournamentStats"
          class="flex justify-between items-center text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
        >
          <div class="flex items-center gap-1">
            <i class="pi pi-users text-gray-500"></i>
            <span>{{ (tournament as any).participants_count || 0 }} participants</span>
          </div>
          <div
            v-if="(tournament as any).matches_played !== undefined"
            class="flex items-center gap-1"
          >
            <i class="pi pi-play text-gray-500"></i>
            <span
              >{{ (tournament as any).matches_played }}/{{
                (tournament as any).matches_total || '?'
              }}
              matchs</span
            >
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between items-center">
        <Button label="Voir détails" text size="small" @click.stop="$emit('click', tournament)" />
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <i class="pi pi-calendar"></i>
          <span>{{ timeFromNow }}</span>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClientBaseTournament } from '@skill-arena/shared/types/index'

interface Props {
  tournament: ClientBaseTournament
  showStats?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showStats: true,
})

defineEmits<{
  click: [tournament: ClientBaseTournament]
}>()

// Status mapping
const statusConfig = {
  draft: { label: 'Brouillon', severity: 'secondary' as const },
  open: { label: 'Ouvert', severity: 'success' as const },
  ongoing: { label: 'En cours', severity: 'warning' as const },
  finished: { label: 'Terminé', severity: 'info' as const },
}

const statusLabel = computed(
  () => statusConfig[props.tournament.status]?.label || props.tournament.status,
)
const statusSeverity = computed(
  () => statusConfig[props.tournament.status]?.severity || 'secondary',
)

// Mode mapping
const modeConfig = {
  championship: { label: 'Championnat', icon: 'pi pi-trophy' },
  bracket: { label: 'Élimination', icon: 'pi pi-sitemap' },
}

const modeLabel = computed(() => modeConfig[props.tournament.mode]?.label || props.tournament.mode)
const modeIcon = computed(() => modeConfig[props.tournament.mode]?.icon || 'pi pi-trophy')

// Check if tournament has stats properties
const hasTournamentStats = computed(() => {
  const t = props.tournament as ClientBaseTournament & {
    participants_count?: number
    matches_played?: number
    matches_total?: number
  }
  return t.participants_count !== undefined || t.matches_played !== undefined
})

// Date formatting
function formatDate(dateString: string | Date): string {
  if (dateString instanceof Date) {
    return dateString.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

// Time from now (simple implementation)
// startDate and endDate are already Date objects (converted by interceptor)
const timeFromNow = computed(() => {
  const now = new Date()
  const start = props.tournament.startDate
  const end = props.tournament.endDate

  if (start > now) {
    const days = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return `Commence dans ${days} jour${days > 1 ? 's' : ''}`
  } else if (end > now) {
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return `Se termine dans ${days} jour${days > 1 ? 's' : ''}`
  } else {
    return 'Terminé'
  }
})
</script>

<style scoped>
.tournament-card {
  border: 1px solid rgb(229, 231, 235);
  border-color: rgb(229, 231, 235);
}

.dark .tournament-card {
  border-color: rgb(55, 65, 81);
}

.tournament-card:hover {
  border-color: rgb(147, 197, 253);
  box-shadow:
    0 10px 25px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transform: translateY(-0.25rem);
}

.dark .tournament-card:hover {
  border-color: rgb(37, 99, 235);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
