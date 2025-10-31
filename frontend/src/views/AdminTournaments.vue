<template>
  <div class="min-h-screen py-8">
    <div class="container mx-auto px-4 max-w-7xl">
      <!-- En-tête -->
      <div class="flex items-center justify-end mb-8">
        <Button
          label="Nouveau tournoi"
          icon="fa-solid fa-plus"
          @click="openCreateDialog"
          severity="success"
        />
      </div>

      <!-- Liste des tournois -->
      <Card>
        <template #title>
          <div class="flex items-center justify-between">
            <span>Tournois existants</span>
            <Badge :value="tournaments.length" severity="info" />
          </div>
        </template>

        <template #content>
          <DataTable
            v-if="tournaments.length > 0"
            :value="tournaments"
            :loading="loading"
            striped-rows
            paginator
            :rows="10"
            data-key="id"
            sort-field="created"
            :sort-order="-1"
          >
            <Column field="name" header="Nom" sortable>
              <template #body="{ data }">
                <div class="font-semibold">{{ data.name }}</div>
                <div class="text-sm">{{ data.description }}</div>
              </template>
            </Column>

            <Column field="type" header="Type" sortable>
              <template #body="{ data }">
                <Tag
                  :value="data.type === 'championship' ? 'Championship' : 'Bracket'"
                  :severity="data.type === 'championship' ? 'info' : 'warning'"
                />
              </template>
            </Column>

            <Column field="min_team_size" header="Équipe" sortable>
              <template #body="{ data }">
                <span class="text-sm">
                  {{ data.min_team_size }} - {{ data.max_team_size }}
                  <i
                    v-if="data.team_flexibility === 'dynamic'"
                    v-tooltip.top="'Équipes dynamiques'"
                    class="fa-solid fa-shuffle text-blue-500 ml-1"
                  />
                </span>
              </template>
            </Column>

            <Column field="start_date" header="Dates" sortable>
              <template #body="{ data }">
                <div class="text-sm">
                  <div>{{ formatDate(data.startDate) }}</div>
                  <div class="">{{ formatDate(data.endDate) }}</div>
                </div>
              </template>
            </Column>

            <Column header="Statut">
              <template #body="{ data }">
                <Tag
                  :value="getTournamentStatus(data).label"
                  :severity="getTournamentStatus(data).severity"
                />
              </template>
            </Column>

            <Column header="Actions">
              <template #body="{ data }">
                <div class="flex gap-2">
                  <Button
                    icon="fa-solid fa-pen"
                    text
                    rounded
                    severity="info"
                    v-tooltip.top="'Modifier'"
                    @click="openEditDialog(data)"
                  />
                  <Button
                    icon="fa-solid fa-trash"
                    text
                    rounded
                    severity="danger"
                    v-tooltip.top="'Supprimer'"
                    @click="confirmDelete(data)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>

          <div v-else class="text-center py-12">
            <i class="fa-solid fa-trophy text-6xl mb-4 text-gray-300"></i>
            <p class="text-lg">Aucun tournoi pour le moment</p>
            <p class="text-sm">Créez votre premier tournoi pour commencer</p>
          </div>
        </template>
      </Card>

      <!-- Dialog de création/édition -->
      <Dialog
        v-model:visible="dialogVisible"
        :header="editingTournament ? 'Modifier le tournoi' : 'Créer un tournoi'"
        :modal="true"
        :style="{ width: '50rem' }"
        :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
      >
        <TournamentForm
          :tournament="editingTournament"
          :loading="submitting"
          @submit="handleSubmit"
          @cancel="closeDialog"
        />
      </Dialog>

      <!-- Dialog de confirmation de suppression -->
      <Dialog
        v-model:visible="deleteDialogVisible"
        header="Confirmer la suppression"
        :modal="true"
        :style="{ width: '450px' }"
      >
        <div class="flex items-start gap-3">
          <i class="fa-solid fa-triangle-exclamation text-4xl text-orange-500"></i>
          <div>
            <p class="mb-3">
              Êtes-vous sûr de vouloir supprimer le tournoi
              <strong>{{ tournamentToDelete?.name }}</strong> ?
            </p>
            <p class="text-sm text-gray-600">
              Cette action est irréversible et supprimera également tous les matchs et équipes
              associés.
            </p>
          </div>
        </div>
        <template #footer>
          <Button
            label="Annuler"
            severity="secondary"
            outlined
            @click="deleteDialogVisible = false"
          />
          <Button label="Supprimer" severity="danger" @click="handleDelete" :loading="deleting" />
        </template>
      </Dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import TournamentForm from '@/components/TournamentForm.vue'
import { useTournaments } from '@/composables/useTournaments'
import { useAuth } from '@/composables/useAuth'
import type { Tournament, TournamentCreate } from '@/types'

const router = useRouter()
const toast = useToast()
const { isAdmin } = useAuth()
const { tournaments, fetchTournaments, createTournament, updateTournament, deleteTournament } =
  useTournaments()

const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const editingTournament = ref<Tournament | undefined>(undefined)
const tournamentToDelete = ref<Tournament | null>(null)

// Vérifier que l'utilisateur est admin
onMounted(async () => {
  if (!isAdmin.value) {
    router.push('/')
    return
  }

  await loadTournaments()
})

const loadTournaments = async () => {
  loading.value = true
  try {
    await fetchTournaments()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Erreur lors du chargement des tournois',
      life: 5000,
    })
    console.error(err)
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  editingTournament.value = undefined
  dialogVisible.value = true
}

const openEditDialog = (tournament: Tournament) => {
  editingTournament.value = tournament
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
  editingTournament.value = undefined
}

const handleSubmit = async (data: TournamentCreate) => {
  submitting.value = true

  try {
    if (editingTournament.value) {
      await updateTournament(editingTournament.value.id, data)
      toast.add({
        severity: 'success',
        summary: 'Succès',
        detail: 'Tournoi modifié avec succès',
        life: 3000,
      })
    } else {
      await createTournament(data)
      toast.add({
        severity: 'success',
        summary: 'Succès',
        detail: 'Tournoi créé avec succès',
        life: 3000,
      })
    }

    closeDialog()
    await loadTournaments()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du tournoi',
      life: 5000,
    })
    console.error(err)
  } finally {
    submitting.value = false
  }
}

const confirmDelete = (tournament: Tournament) => {
  tournamentToDelete.value = tournament
  deleteDialogVisible.value = true
}

const handleDelete = async () => {
  if (!tournamentToDelete.value) return

  deleting.value = true

  try {
    await deleteTournament(tournamentToDelete.value.id)
    toast.add({
      severity: 'success',
      summary: 'Succès',
      detail: 'Tournoi supprimé avec succès',
      life: 3000,
    })
    deleteDialogVisible.value = false
    tournamentToDelete.value = null
    await loadTournaments()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err instanceof Error ? err.message : 'Erreur lors de la suppression du tournoi',
      life: 5000,
    })
    console.error(err)
  } finally {
    deleting.value = false
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getTournamentStatus = (tournament: Tournament) => {
  const now = new Date()
  const start = new Date(tournament.start_date)
  const end = new Date(tournament.end_date)

  if (now < start) {
    return { label: 'À venir', severity: 'info' }
  } else if (now > end) {
    return { label: 'Terminé', severity: 'secondary' }
  } else {
    return { label: 'En cours', severity: 'success' }
  }
}
</script>
