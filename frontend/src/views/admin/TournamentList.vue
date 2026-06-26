<template>
  <div class="tournament-list-view p-4">
    <h1 class="text-2xl font-bold mb-4">{{ t('tournamentList.title') }}</h1>
    <div class="flex justify-between items-center mb-4 flex-xrap">
      <div class="flex flex-wrap gap-4">
        <Select
          v-model="selectedStatus"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('tournamentList.allStatuses')"
          show-clear
          class="w-48"
          @change="applyFilters"
        />
        <Select
          v-model="selectedMode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('tournamentList.allModes')"
          show-clear
          class="w-48"
          @change="applyFilters"
        />
      </div>
      <div>
        <Button
          v-if="canCreateTournament"
          :label="t('tournamentList.newTournament')"
          icon="fa fa-plus"
          @click="router.push('/admin/tournaments/new')"
        />
      </div>
    </div>
    <!-- Error message -->
    <Message v-if="error" severity="error" :closable="true">
      {{ error }}
    </Message>

    <!-- DataTable -->
    <DataTable
      :value="tournaments"
      :loading="loading"
      striped-rows
      paginator
      :rows="10"
      :rows-per-page-options="[5, 10, 20, 50]"
      responsive-layout="scroll"
      class="p-datatable-sm"
    >
      <Column field="name" :header="t('common.name')" sortable>
        <template #body="{ data }">
          <router-link
            :to="`/admin/tournaments/${data.id}/edit`"
            class="text-primary hover:underline font-semibold"
          >
            {{ data.name }}
          </router-link>
        </template>
      </Column>

      <Column field="mode" :header="t('tournamentList.colMode')" sortable>
        <template #body="{ data }">
          <Tag
            :value="data.mode === 'championship' ? t('tournamentList.modeChampionship') : t('tournamentList.modeBracket')"
            :severity="data.mode === 'championship' ? 'info' : 'warning'"
          />
        </template>
      </Column>

      <Column field="teamMode" :header="t('tournamentList.colTeams')" sortable>
        <template #body="{ data }">
          <span>
            {{ data.teamMode === 'static' ? t('tournamentList.teamModeStatic') : t('tournamentList.teamModeFlex') }}
            ({{ data.teamSize }}v{{ data.teamSize }})
          </span>
        </template>
      </Column>

      <Column field="startDate" :header="t('tournamentList.colStart')" sortable>
        <template #body="{ data }">
          {{ formatDate(data.startDate) }}
        </template>
      </Column>

      <Column field="endDate" :header="t('tournamentList.colEnd')" sortable>
        <template #body="{ data }">
          {{ formatDate(data.endDate) }}
        </template>
      </Column>

      <Column field="status" :header="t('tournamentList.colStatus')" sortable>
        <template #body="{ data }">
          <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" />
        </template>
      </Column>

      <Column :header="t('common.actions')" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              v-if="canManageTournament(data)"
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="router.push(`/admin/tournaments/${data.id}/edit`)"
              v-tooltip.top="t('common.edit')"
            />
            <Button
              v-if="canDeleteTournament(data)"
              icon="fa fa-trash"
              size="small"
              severity="danger"
              text
              rounded
              @click="confirmDelete(data)"
              v-tooltip.top="t('common.delete')"
            />
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="text-center py-8">
          <p class="text-gray-500 mb-4">{{ t('tournamentList.empty') }}</p>
          <Button
            v-if="canCreateTournament"
            :label="t('tournamentList.createFirst')"
            icon="pi pi-plus"
            @click="router.push('/admin/tournaments/new')"
          />
        </div>
      </template>
    </DataTable>

    <!-- Delete confirmation dialog -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      :header="t('tournamentList.deleteDialogTitle', { name: tournamentToDelete?.name })"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex items-center gap-3 mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span>{{ t('tournamentList.deleteConfirm') }}</span>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" icon="pi pi-times" @click="deleteDialogVisible = false" text />
        <Button
          :label="t('common.delete')"
          icon="pi pi-check"
          @click="handleDelete"
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
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useI18n } from 'vue-i18n'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import type { TournamentResponse } from '@/composables/tournament/tournament.api'

const router = useRouter()
const { t } = useI18n()
const {
  tournaments,
  loading,
  error,
  canCreateTournament,
  canManageTournament,
  canDeleteTournament,
  listTournaments,
  deleteTournament,
} = useTournamentService()

const selectedStatus = ref()
const selectedMode = ref()
const deleteDialogVisible = ref(false)
const tournamentToDelete = ref<TournamentResponse | null>(null)

const statusOptions = [
  { label: t('tournamentList.statusDraft'), value: 'draft' },
  { label: t('tournamentList.statusOpen'), value: 'open' },
  { label: t('tournamentList.statusOngoing'), value: 'ongoing' },
  { label: t('tournamentList.statusFinished'), value: 'finished' },
]

const modeOptions = [
  { label: t('tournamentList.modeChampionship'), value: 'championship' },
  { label: t('tournamentList.modeBracket'), value: 'bracket' },
]

function formatDate(date: Date): string {
  return format(date, 'dd MMM yyyy', { locale: fr })
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: t('tournamentList.statusDraft'),
    open: t('tournamentList.statusOpen'),
    ongoing: t('tournamentList.statusOngoing'),
    finished: t('tournamentList.statusFinished'),
  }
  return labels[status] || status
}

function getStatusSeverity(status: string): string {
  const severities: Record<string, string> = {
    draft: 'secondary',
    open: 'info',
    ongoing: 'success',
    finished: 'danger',
  }
  return severities[status] || 'secondary'
}

function applyFilters() {
  listTournaments({
    status: selectedStatus.value,
    mode: selectedMode.value,
  })
}

function confirmDelete(tournament: TournamentResponse) {
  tournamentToDelete.value = tournament
  deleteDialogVisible.value = true
}

async function handleDelete() {
  if (!tournamentToDelete.value) return

  try {
    await deleteTournament(tournamentToDelete.value.id)
    deleteDialogVisible.value = false
    tournamentToDelete.value = null
  } catch (err) {
    console.error('Erreur lors de la suppression:', err)
  }
}

onMounted(() => {
  listTournaments()
})
</script>

<style scoped>
.tournament-list-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
