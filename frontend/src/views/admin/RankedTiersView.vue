<template>
  <div class="ranked-tiers p-4">
    <div class="flex items-center gap-3 mb-4">
      <Button
        icon="fa fa-arrow-left"
        text
        rounded
        @click="router.push('/admin/ranked')"
        v-tooltip.top="t('rankedTiersView.tooltipBack')"
      />
      <div>
        <h1 class="text-2xl font-bold">{{ t('rankedTiersView.title') }}</h1>
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
        :label="t('rankedTiersView.addRank')"
        icon="fa fa-plus"
        @click="openCreateDialog"
      />
      <Button
        :label="t('rankedTiersView.recalculateThresholds')"
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
      <Column field="level" :header="t('rankedTiersView.colLevel')" sortable style="width: 6rem" />

      <Column :header="t('rankedTiersView.formIcon')" style="width: 4rem">
        <template #body="{ data }">
          <i :class="getTierIconClass(data)" class="text-xl" />
        </template>
      </Column>

      <Column field="name" :header="t('common.name')" />

      <Column field="percentile" :header="t('rankedTiersView.colPercentile')" sortable style="width: 10rem">
        <template #body="{ data }">
          {{ Math.round(data.percentile * 100) }}%
        </template>
      </Column>

      <Column field="subRanks" :header="t('rankedTiersView.colSubRanks')" style="width: 9rem">
        <template #body="{ data }">
          {{ data.subRanks > 1 ? data.subRanks : '—' }}
        </template>
      </Column>

      <Column field="minMmr" :header="t('rankedTiersView.colMinMmr')" sortable style="width: 8rem" />

      <Column field="calculatedAt" :header="t('rankedTiersView.colCalculatedAt')" style="width: 12rem">
        <template #body="{ data }">
          {{ formatDate(data.calculatedAt) }}
        </template>
      </Column>

      <Column :header="t('common.actions')" style="width: 8rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="openEditDialog(data)"
              v-tooltip.top="t('common.edit')"
            />
            <Button
              icon="fa fa-trash"
              size="small"
              text
              rounded
              severity="danger"
              @click="confirmDelete(data)"
              v-tooltip.top="t('common.delete')"
            />
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="text-center py-8">
          <p class="text-surface-500">{{ t('rankedTiersView.empty') }}</p>
        </div>
      </template>
    </DataTable>

    <!-- Create / Edit Dialog -->
    <Dialog
      v-model:visible="formDialogVisible"
      :header="editingTier ? t('rankedTiersView.editDialogTitle') : t('rankedTiersView.addDialogTitle')"
      :modal="true"
      :style="{ width: '420px' }"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div v-if="!editingTier" class="flex flex-col gap-1">
          <label for="tier-level" class="font-medium text-sm">{{ t('rankedTiersView.formLevel') }}</label>
          <InputNumber v-model="form.level" input-id="tier-level" :min="1" :max="99" showButtons />
        </div>
        <div class="flex flex-col gap-1">
          <label for="tier-name" class="font-medium text-sm">{{ t('rankedTiersView.formName') }}</label>
          <InputText id="tier-name" v-model="form.name" :placeholder="t('rankedTiersView.formNamePlaceholder')" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="tier-percentile" class="font-medium text-sm">{{ t('rankedTiersView.formPercentile') }}</label>
          <InputNumber v-model="form.percentile" input-id="tier-percentile" :min="0" :max="1" :step="0.01" :minFractionDigits="2" :maxFractionDigits="2" />
          <small class="text-surface-400">{{ t('rankedTiersView.formPercentileHelp') }}</small>
        </div>
        <div class="flex flex-col gap-1">
          <label for="tier-minmmr" class="font-medium text-sm">{{ t('rankedTiersView.formMinMmr') }}</label>
          <InputNumber v-model="form.minMmr" input-id="tier-minmmr" :min="0" showButtons />
        </div>
        <div class="flex flex-col gap-1">
          <label for="tier-subranks" class="font-medium text-sm">{{ t('rankedTiersView.formSubRanks') }}</label>
          <InputNumber v-model="form.subRanks" input-id="tier-subranks" :min="1" :max="10" showButtons />
          <small class="text-surface-400">{{ t('rankedTiersView.formSubRanksHelp') }}</small>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-medium text-sm">{{ t('rankedTiersView.formIcon') }}</label>
          <FontAwesomeIconPicker v-model="form.iconClass" />
          <small class="text-surface-400">{{ t('rankedTiersView.formIconHelp') }}</small>
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="formDialogVisible = false" />
        <Button
          :label="editingTier ? t('common.save') : t('common.create')"
          icon="fa fa-check"
          :loading="loading"
          @click="handleSubmit"
        />
      </template>
    </Dialog>

    <!-- Delete Confirmation -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      :header="t('rankedTiersView.deleteDialogTitle')"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="flex items-start gap-3">
        <i class="pi pi-exclamation-triangle text-3xl text-orange-500"></i>
        <div class="flex flex-col gap-2">
          <span>{{ t('rankedTiersView.deleteConfirm', { name: tierToDelete?.name }) }}</span>
          <small class="text-surface-400">{{ t('rankedTiersView.deleteRenumberHint') }}</small>
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="deleteDialogVisible = false" />
        <Button :label="t('rankedTiersView.delete')" icon="fa fa-trash" severity="danger" :loading="loading" @click="handleDelete" />
      </template>
    </Dialog>

    <!-- Recalculate Confirmation -->
    <Dialog
      v-model:visible="recalcDialogVisible"
      :header="t('rankedTiersView.recalcDialogTitle')"
      :modal="true"
      :style="{ width: '420px' }"
    >
      <div class="flex items-center gap-3">
        <i class="pi pi-info-circle text-3xl text-blue-500"></i>
        <span>{{ t('rankedTiersView.recalcConfirm') }}</span>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="recalcDialogVisible = false" />
        <Button :label="t('rankedTiersView.recalculate')" icon="fa fa-calculator" :loading="loading" @click="handleRecalculate" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useRankedService } from '@/composables/ranked/ranked.service'
import { getTierIconClass } from '@/composables/ranked/tier-style'
import FontAwesomeIconPicker from '@/components/forms/FontAwesomeIconPicker.vue'
import type { ClientRankTier } from '@skol-arena/shared/types/index'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const seasonId = route.params.id as string

const { tiers, currentSeason, loading, error, loadTiers, loadSeasonById, createTier, updateTier, deleteTier, recalculateTiers } = useRankedService()

const formDialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const recalcDialogVisible = ref(false)
const editingTier = ref<ClientRankTier | null>(null)
const tierToDelete = ref<ClientRankTier | null>(null)

const form = ref({ level: 1, name: '', percentile: 0, minMmr: 0, subRanks: 1, iconClass: '' })

function openCreateDialog() {
  editingTier.value = null
  form.value = { level: (tiers.value.length > 0 ? Math.max(...tiers.value.map((t) => t.level)) + 1 : 1), name: '', percentile: 0, minMmr: 0, subRanks: 1, iconClass: '' }
  formDialogVisible.value = true
}

function openEditDialog(tier: ClientRankTier) {
  editingTier.value = tier
  form.value = { level: tier.level, name: tier.name, percentile: tier.percentile, minMmr: tier.minMmr, subRanks: tier.subRanks ?? 1, iconClass: tier.iconClass ?? '' }
  formDialogVisible.value = true
}

async function handleSubmit() {
  if (editingTier.value) {
    const ok = await updateTier(seasonId, editingTier.value.level, {
      name: form.value.name,
      percentile: form.value.percentile,
      minMmr: form.value.minMmr,
      subRanks: form.value.subRanks,
      iconClass: form.value.iconClass || null,
    })
    if (ok) formDialogVisible.value = false
  } else {
    const ok = await createTier(seasonId, { ...form.value, iconClass: form.value.iconClass || null })
    if (ok) formDialogVisible.value = false
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
    draft: t('rankedTiersView.statusDraft'),
    open: t('rankedTiersView.statusOpen'),
    ongoing: t('rankedTiersView.statusOngoing'),
    finished: t('rankedTiersView.statusFinished'),
    cancelled: t('rankedTiersView.statusCancelled'),
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
