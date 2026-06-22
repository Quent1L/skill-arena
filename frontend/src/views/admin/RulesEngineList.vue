<template>
  <div class="rules-engine-list p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Moteur de règles</h1>
      <div class="flex items-center gap-2">
        <Button
          label="Recalculer les badges"
          icon="fa fa-rotate"
          severity="secondary"
          outlined
          :loading="reconciling"
          @click="handleReconcile"
          v-tooltip.bottom="'Lance immédiatement un recalcul complet des badges (sinon exécuté chaque nuit)'"
        />
        <Button label="Nouvelle règle" icon="fa fa-plus" @click="router.push('/admin/rules-engine/new')" />
      </div>
    </div>

    <Message v-if="reconciliationStatus?.dirty" severity="info" :closable="false" class="mb-3">
      Des badges ont été modifiés depuis le dernier recalcul. Le recalcul tournera automatiquement cette nuit, ou
      lancez-le maintenant.
    </Message>
    <p v-if="reconciliationStatus?.lastRunAt" class="text-xs text-surface-500 mb-3">
      Dernier recalcul des badges : {{ formatRunDate(reconciliationStatus.lastRunAt) }}
    </p>

    <Message v-if="error" severity="error" :closable="true">{{ error }}</Message>

    <div class="flex flex-wrap gap-3 mb-4">
      <Select
        v-model="filters.type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        placeholder="Type"
        show-clear
        class="w-48"
        @change="reload"
      />
      <Select
        v-model="filters.scope"
        :options="scopeOptions"
        option-label="label"
        option-value="value"
        placeholder="Portée"
        show-clear
        class="w-48"
        @change="reload"
      />
      <Select
        v-model="filters.isActive"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        placeholder="Statut"
        show-clear
        class="w-48"
        @change="reload"
      />
    </div>

    <DataTable
      :value="rules"
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

      <Column field="type" header="Type" sortable>
        <template #body="{ data }">
          <Tag :severity="data.type === 'badge' ? 'warn' : 'info'" :value="typeLabel(data.type)" />
        </template>
      </Column>

      <Column field="triggerEvent" header="Événement" sortable />

      <Column field="scope" header="Portée" sortable>
        <template #body="{ data }">{{ scopeLabel(data.scope) }}</template>
      </Column>

      <Column field="priority" header="Priorité" sortable />

      <Column field="isActive" header="Actif" sortable>
        <template #body="{ data }">
          <Tag :severity="data.isActive ? 'success' : 'secondary'" :value="data.isActive ? 'Oui' : 'Non'" />
        </template>
      </Column>

      <Column header="Actions" style="width: 11rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="router.push(`/admin/rules-engine/${data.id}/edit`)"
              v-tooltip.top="'Modifier'"
            />
            <Button
              icon="fa fa-copy"
              size="small"
              text
              rounded
              :disabled="loading"
              @click="handleDuplicate(data)"
              v-tooltip.top="'Dupliquer'"
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
          <p class="text-gray-500 mb-4">Aucune règle trouvée</p>
          <Button label="Créer une règle" icon="fa fa-plus" @click="router.push('/admin/rules-engine/new')" />
        </div>
      </template>
    </DataTable>

    <Dialog v-model:visible="deleteDialogVisible" header="Supprimer la règle ?" :modal="true" :style="{ width: '450px' }">
      <div class="flex items-center gap-3 mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-orange-500"></i>
        <span>
          Supprimer la règle <strong>{{ ruleToDelete?.name }}</strong> ? Cette action est irréversible.
        </span>
      </div>
      <Message
        v-if="ruleToDelete?.type === 'badge' && badgeHolderCount > 0"
        severity="warn"
        :closable="false"
        class="mb-2"
      >
        {{ badgeHolderCount }} joueur(s) possèdent actuellement ce badge. Si vous continuez, il leur sera
        définitivement retiré.
      </Message>
      <template #footer>
        <Button label="Annuler" icon="pi pi-times" @click="deleteDialogVisible = false" text />
        <Button label="Supprimer" icon="pi pi-check" severity="danger" :loading="loading" @click="handleDelete" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useRulesService } from '@/composables/rules/rules.service'
import type { ClientRule, CreateRuleData } from '@skill-arena/shared/types/index'

const router = useRouter()
const {
  rules,
  loading,
  error,
  loadRules,
  deleteRule,
  createRule,
  getBadgeCount,
  reconciliationStatus,
  loadReconciliationStatus,
  triggerReconciliation,
} = useRulesService()

const reconciling = ref(false)
const toast = useToast()

const filters = reactive<{ type?: 'message' | 'badge'; scope?: 'global' | 'discipline'; isActive?: boolean }>({})

const typeOptions = [
  { label: 'Message', value: 'message' },
  { label: 'Badge', value: 'badge' },
]
const scopeOptions = [
  { label: 'Global', value: 'global' },
  { label: 'Discipline', value: 'discipline' },
]
const statusOptions = [
  { label: 'Actif', value: true },
  { label: 'Inactif', value: false },
]

const deleteDialogVisible = ref(false)
const ruleToDelete = ref<ClientRule | null>(null)
const badgeHolderCount = ref(0)

function typeLabel(type: string) {
  return type === 'badge' ? 'Badge' : 'Message'
}
function scopeLabel(scope: string) {
  return scope === 'discipline' ? 'Discipline' : 'Global'
}

function reload() {
  loadRules({ type: filters.type, scope: filters.scope, isActive: filters.isActive })
}

function formatRunDate(date: Date) {
  return new Date(date).toLocaleString('fr-FR')
}

async function handleReconcile() {
  reconciling.value = true
  const ok = await triggerReconciliation()
  reconciling.value = false
  toast.add({
    severity: ok ? 'success' : 'error',
    summary: ok ? 'Recalcul lancé' : 'Erreur',
    detail: ok
      ? 'Le recalcul des badges a été mis en file. Il s’exécute en arrière-plan.'
      : 'Impossible de lancer le recalcul.',
    life: 4000,
  })
}

async function handleDuplicate(rule: ClientRule) {
  const copy: CreateRuleData = {
    triggerEvent: rule.triggerEvent,
    type: rule.type,
    scope: rule.scope,
    disciplineId: rule.disciplineId,
    priority: rule.priority,
    name: `${rule.name} (copie)`,
    description: rule.description,
    conditions: rule.conditions,
    action: rule.action,
    isActive: false,
  }
  await createRule(copy)
}

async function confirmDelete(rule: ClientRule) {
  ruleToDelete.value = rule
  badgeHolderCount.value = 0
  deleteDialogVisible.value = true
  if (rule.type === 'badge') {
    badgeHolderCount.value = await getBadgeCount(rule.id)
  }
}

async function handleDelete() {
  if (!ruleToDelete.value) return
  const success = await deleteRule(ruleToDelete.value.id)
  if (success) {
    deleteDialogVisible.value = false
    ruleToDelete.value = null
  }
}

onMounted(() => {
  loadRules()
  loadReconciliationStatus()
})
</script>

<style scoped>
.rules-engine-list {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
