<template>
  <div class="ranked-tiers p-4">
    <div class="flex items-center gap-3 mb-4">
      <Button
        icon="fa fa-arrow-left"
        text
        rounded
        @click="router.push('/admin/ranked')"
        v-tooltip.top="'Retour à la liste'"
      />
      <div>
        <h1 class="text-2xl font-bold">Gestion des rangs</h1>
        <p v-if="currentSeason" class="text-sm text-surface-500">
          {{ currentSeason.name }}
          <Tag :severity="statusSeverity(currentSeason.status)" :value="statusLabel(currentSeason.status)" class="ml-2" />
        </p>
      </div>
    </div>

    <Message v-if="error" severity="error" :closable="true" class="mb-4">
      {{ error }}
    </Message>

    <div class="flex justify-between items-center mb-3">
      <Button
        label="Ajouter un rang"
        icon="fa fa-plus"
        @click="openCreateDialog"
      />
      <Button
        label="Recalculer les seuils MMR"
        icon="fa fa-calculator"
        severity="secondary"
        @click="confirmRecalculate"
      />
    </div>

    <DataTable
      :value="tiers"
      :loading="loading"
      striped-rows
      class="p-datatable-sm"
    >
      <Column field="level" header="Niveau" sortable style="width: 6rem" />

      <Column field="name" header="Nom" />

      <Column field="percentile" header="Percentile" sortable style="width: 10rem">
        <template #body="{ data }">
          {{ Math.round(data.percentile * 100) }}%
        </template>
      </Column>

      <Column field="subRanks" header="Sous-rangs" style="width: 9rem">
        <template #body="{ data }">
          {{ data.subRanks > 1 ? data.subRanks : '—' }}
        </template>
      </Column>

      <Column field="minMmr" header="MMR min" sortable style="width: 8rem" />

      <Column field="calculatedAt" header="Calculé le" style="width: 12rem">
        <template #body="{ data }">
          {{ formatDate(data.calculatedAt) }}
        </template>
      </Column>

      <Column header="Actions" style="width: 8rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="openEditDialog(data)"
              v-tooltip.top="'Modifier'"
            />
            <Button
              icon="fa fa-trash"
              size="small"
              text
              rounded
              severity="danger"
              @click="confirmDelete(data)"
              v-tooltip.top="'Supprimer'"
            />
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="text-center py-8">
          <p class="text-surface-500">Aucun rang défini pour cette saison</p>
        </div>
      </template>
    </DataTable>

    <!-- Create / Edit Dialog -->
    <Dialog
      v-model:visible="formDialogVisible"
      :header="editingTier ? 'Modifier le rang' : 'Ajouter un rang'"
      :modal="true"
      :style="{ width: '420px' }"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div v-if="!editingTier" class="flex flex-col gap-1">
          <label class="font-medium text-sm">Niveau</label>
          <InputNumber v-model="form.level" :min="1" :max="99" showButtons />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-medium text-sm">Nom</label>
          <InputText v-model="form.name" placeholder="Ex: Légende" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-medium text-sm">Percentile (0 à 1)</label>
          <InputNumber v-model="form.percentile" :min="0" :max="1" :step="0.01" :minFractionDigits="2" :maxFractionDigits="2" />
          <small class="text-surface-400">Seuil de MMR basé sur la distribution des joueurs</small>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-medium text-sm">MMR minimum</label>
          <InputNumber v-model="form.minMmr" :min="0" showButtons />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-medium text-sm">Sous-rangs</label>
          <InputNumber v-model="form.subRanks" :min="1" :max="10" showButtons />
          <small class="text-surface-400">1 = pas de sous-rang. Ex: 5 → Silver 5, Silver 4, ..., Silver 1</small>
        </div>
      </div>
      <template #footer>
        <Button label="Annuler" text @click="formDialogVisible = false" />
        <Button
          :label="editingTier ? 'Enregistrer' : 'Créer'"
          icon="fa fa-check"
          :loading="loading"
          @click="handleSubmit"
        />
      </template>
    </Dialog>

    <!-- Delete Confirmation -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Supprimer le rang ?"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="flex items-center gap-3">
        <i class="pi pi-exclamation-triangle text-3xl text-orange-500"></i>
        <span>
          Supprimer le rang <strong>{{ tierToDelete?.name }}</strong> ?
          Cette action est irréversible.
        </span>
      </div>
      <template #footer>
        <Button label="Annuler" text @click="deleteDialogVisible = false" />
        <Button label="Supprimer" icon="fa fa-trash" severity="danger" :loading="loading" @click="handleDelete" />
      </template>
    </Dialog>

    <!-- Recalculate Confirmation -->
    <Dialog
      v-model:visible="recalcDialogVisible"
      header="Recalculer les seuils MMR ?"
      :modal="true"
      :style="{ width: '420px' }"
    >
      <div class="flex items-center gap-3">
        <i class="pi pi-info-circle text-3xl text-blue-500"></i>
        <span>
          Les valeurs MMR minimum de chaque rang seront recalculées selon les percentiles
          et la distribution MMR actuelle des joueurs.
        </span>
      </div>
      <template #footer>
        <Button label="Annuler" text @click="recalcDialogVisible = false" />
        <Button label="Recalculer" icon="fa fa-calculator" :loading="loading" @click="handleRecalculate" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRankedService } from '@/composables/ranked/ranked.service'
import type { ClientRankTier } from '@skill-arena/shared/types/index'

const route = useRoute()
const router = useRouter()
const seasonId = route.params.id as string

const { tiers, currentSeason, loading, error, loadTiers, loadSeasonById, createTier, updateTier, deleteTier, recalculateTiers } = useRankedService()

const formDialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const recalcDialogVisible = ref(false)
const editingTier = ref<ClientRankTier | null>(null)
const tierToDelete = ref<ClientRankTier | null>(null)

const form = ref({ level: 1, name: '', percentile: 0, minMmr: 0, subRanks: 1 })

function openCreateDialog() {
  editingTier.value = null
  form.value = { level: (tiers.value.length > 0 ? Math.max(...tiers.value.map((t) => t.level)) + 1 : 1), name: '', percentile: 0, minMmr: 0, subRanks: 1 }
  formDialogVisible.value = true
}

function openEditDialog(tier: ClientRankTier) {
  editingTier.value = tier
  form.value = { level: tier.level, name: tier.name, percentile: tier.percentile, minMmr: tier.minMmr, subRanks: tier.subRanks ?? 1 }
  formDialogVisible.value = true
}

async function handleSubmit() {
  if (editingTier.value) {
    const ok = await updateTier(seasonId, editingTier.value.level, {
      name: form.value.name,
      percentile: form.value.percentile,
      minMmr: form.value.minMmr,
      subRanks: form.value.subRanks,
    })
    if (ok) formDialogVisible.value = false
  } else {
    const created = await createTier(seasonId, form.value)
    if (created) formDialogVisible.value = false
  }
}

function confirmDelete(tier: ClientRankTier) {
  tierToDelete.value = tier
  deleteDialogVisible.value = true
}

async function handleDelete() {
  if (!tierToDelete.value) return
  const ok = await deleteTier(seasonId, tierToDelete.value.level)
  if (ok) {
    deleteDialogVisible.value = false
    tierToDelete.value = null
  }
}

function confirmRecalculate() {
  recalcDialogVisible.value = true
}

async function handleRecalculate() {
  const ok = await recalculateTiers(seasonId)
  if (ok) recalcDialogVisible.value = false
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
  const map: Record<string, string> = {
    draft: 'secondary',
    open: 'info',
    ongoing: 'success',
    finished: 'contrast',
    cancelled: 'danger',
  }
  return map[status] ?? 'secondary'
}

onMounted(async () => {
  await Promise.all([loadSeasonById(seasonId), loadTiers(seasonId)])
})
</script>

<style scoped>
.ranked-tiers {
  max-width: 1000px;
  margin: 0 auto;
}
</style>
