<template>
  <Card class="cursor-pointer hover:shadow-lg transition-shadow" @click="goToTournament">
    <template #header>
      <div class="relative">
        <div
          class="h-32 bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center"
        >
          <i class="fas fa-trophy text-5xl text-white/80"></i>
        </div>
        <div class="absolute top-2 right-2">
          <Tag :severity="statusSeverity" :value="statusLabel" />
        </div>
      </div>
    </template>

    <template #title>
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-xl font-bold line-clamp-2">{{ tournament.name }}</h3>
      </div>
    </template>

    <template #subtitle>
      <div class="flex items-center gap-2 mt-2">
        <Tag :value="typeLabel" severity="secondary" />
      </div>
    </template>

    <template #content>
      <div class="space-y-3">
        <p
          v-if="tournament.description"
          v-html="tournament.description"
          class="line-clamp-2 text-sm opacity-80"
        ></p>

        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <i class="fas fa-calendar"></i>
            <span>{{ formatDate(tournament.start_date) }}</span>
          </div>

          <div v-if="tournamentStats" class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <i class="fas fa-users"></i>
              <span>{{ tournamentStats.participants_count }} équipes</span>
            </div>
            <div class="flex items-center gap-2">
              <i class="fas fa-futbol"></i>
              <span
                >{{ tournamentStats.matches_played }}/{{
                  tournamentStats.matches_total
                }}
                matchs</span
              >
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-2">
        <Button label="Voir" icon="fas fa-eye" text size="small" @click.stop="goToTournament" />
        <Button
          v-if="canEdit"
          label="Modifier"
          icon="fas fa-edit"
          text
          severity="secondary"
          size="small"
          @click.stop="editTournament"
        />
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Tournament, TournamentWithStats } from '@/types'

interface Props {
  tournament: Tournament | TournamentWithStats
  canEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: false,
})

const router = useRouter()

const tournamentStats = computed(() => {
  return 'status' in props.tournament ? (props.tournament as TournamentWithStats) : null
})

const statusSeverity = computed(() => {
  if (!tournamentStats.value) return 'info'

  switch (tournamentStats.value.status) {
    case 'active':
      return 'success'
    case 'upcoming':
      return 'warning'
    case 'finished':
      return 'secondary'
    default:
      return 'info'
  }
})

const statusLabel = computed(() => {
  if (!tournamentStats.value) return 'À venir'

  switch (tournamentStats.value.status) {
    case 'active':
      return 'En cours'
    case 'upcoming':
      return 'À venir'
    case 'finished':
      return 'Terminé'
    default:
      return 'À venir'
  }
})

const typeLabel = computed(() => {
  switch (props.tournament.type) {
    case 'championship':
      return 'Championnat'
    case 'bracket':
      return 'Élimination directe'
    default:
      return props.tournament.type
  }
})

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function goToTournament() {
  router.push(`/tournaments/${props.tournament.id}`)
}

function editTournament() {
  router.push(`/tournaments/${props.tournament.id}/edit`)
}
</script>
