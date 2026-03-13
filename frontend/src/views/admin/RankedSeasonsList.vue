<template>
  <div class="ranked-seasons-list p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Saisons Ranked</h1>
      <Button
        label="Nouvelle saison"
        icon="fa fa-plus"
        @click="router.push('/admin/ranked/new')"
      />
    </div>

    <Message v-if="error" severity="error" :closable="true">
      {{ error }}
    </Message>

    <DataTable
      :value="seasons"
      :loading="loading"
      striped-rows
      paginator
      :rows="10"
      :rows-per-page-options="[5, 10, 20, 50]"
      responsive-layout="scroll"
      class="p-datatable-sm"
    >
      <Column field="name" header="Nom" sortable>
        <template #body="{ data }">
          <span class="font-semibold">{{ data.name }}</span>
        </template>
      </Column>

      <Column field="discipline.name" header="Discipline" sortable />

      <Column field="status" header="Statut" sortable>
        <template #body="{ data }">
          <Tag :severity="statusSeverity(data.status)" :value="statusLabel(data.status)" />
        </template>
      </Column>

      <Column field="startDate" header="Début" sortable>
        <template #body="{ data }">
          {{ formatDate(data.startDate) }}
        </template>
      </Column>

      <Column field="endDate" header="Fin" sortable>
        <template #body="{ data }">
          {{ formatDate(data.endDate) }}
        </template>
      </Column>

      <Column header="Actions" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-eye"
              size="small"
              text
              rounded
              @click="router.push(`/ranked/${data.id}`)"
              v-tooltip.top="'Voir'"
            />
            <Button
              v-if="data.status === 'draft'"
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="router.push(`/admin/ranked/${data.id}/edit`)"
              v-tooltip.top="'Modifier'"
            />
            <Button
              v-if="data.status === 'draft'"
              icon="fa fa-play"
              size="small"
              text
              rounded
              severity="success"
              @click="handleStart(data)"
              v-tooltip.top="'Démarrer'"
            />
            <Button
              v-if="data.status === 'ongoing'"
              icon="fa fa-stop"
              size="small"
              text
              rounded
              severity="danger"
              @click="confirmEnd(data)"
              v-tooltip.top="'Terminer'"
            />
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="text-center py-8">
          <p class="text-gray-500 mb-4">Aucune saison ranked trouvée</p>
          <Button
            label="Créer une saison"
            icon="fa fa-plus"
            @click="router.push('/admin/ranked/new')"
          />
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="endDialogVisible"
      header="Terminer la saison ?"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex items-center gap-3 mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-orange-500"></i>
        <span>
          Êtes-vous sûr de vouloir terminer la saison
          <strong>{{ seasonToEnd?.name }}</strong> ? Cette action est irréversible.
        </span>
      </div>
      <template #footer>
        <Button label="Annuler" icon="pi pi-times" @click="endDialogVisible = false" text />
        <Button
          label="Terminer"
          icon="pi pi-check"
          @click="handleEnd"
          severity="danger"
          :loading="loading"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRankedService } from '@/composables/ranked/ranked.service'
import type { RankedSeason } from '@/composables/ranked/ranked.api'

const router = useRouter()
const { seasons, loading, error, loadSeasons, startSeason, endSeason } = useRankedService()

const endDialogVisible = ref(false)
const seasonToEnd = ref<RankedSeason | null>(null)

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Brouillon',
    open: 'Ouvert',
    ongoing: 'En cours',
    finished: 'Terminé',
    cancelled: 'Annulé',
  }
  return labels[status] ?? status
}

function statusSeverity(status: string) {
  const severities: Record<string, string> = {
    draft: 'secondary',
    open: 'info',
    ongoing: 'success',
    finished: 'contrast',
    cancelled: 'danger',
  }
  return severities[status] ?? 'secondary'
}

async function handleStart(season: RankedSeason) {
  await startSeason(season.id)
  await loadSeasons()
}

function confirmEnd(season: RankedSeason) {
  seasonToEnd.value = season
  endDialogVisible.value = true
}

async function handleEnd() {
  if (!seasonToEnd.value) return
  const success = await endSeason(seasonToEnd.value.id)
  if (success) {
    endDialogVisible.value = false
    seasonToEnd.value = null
    await loadSeasons()
  }
}

onMounted(() => {
  loadSeasons()
})
</script>

<style scoped>
.ranked-seasons-list {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
