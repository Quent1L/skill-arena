<template>
  <div class="rules-engine-list p-4">
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold">{{ t('rulesEngineList.title') }}</h1>
        <Tag :value="t('rulesEngineList.betaTag')" severity="warn" />
      </div>
      <div class="flex items-center gap-2">
        <Button
          :label="t('rulesEngineList.recalculateBadges')"
          icon="fa fa-rotate"
          severity="secondary"
          outlined
          :loading="reconciling"
          @click="handleReconcile"
          v-tooltip.bottom="t('rulesEngineList.recalculateBadgesTooltip')"
        />
        <Button :label="t('rulesEngineList.newRule')" icon="fa fa-plus" @click="router.push('/admin/rules-engine/new')" />
      </div>
    </div>

    <Message severity="warn" :closable="false" class="mb-3">
      <i class="fa fa-triangle-exclamation mr-2" />{{ t('rulesEngineList.betaWarning') }}
    </Message>

    <!-- Rules the startup patch chain could not rewrite. They stay deactivated until
         someone edits them, so they need to be visible without opening each one. -->
    <Message v-if="migrationDisabled.length" severity="error" :closable="false" class="mb-3">
      <p class="font-semibold">
        {{ t('rulesEngineList.migrationDisabledTitle', { count: migrationDisabled.length }) }}
      </p>
      <p class="text-sm mt-1">{{ t('rulesEngineList.migrationDisabledHelp') }}</p>
      <ul class="text-sm mt-2 list-disc list-inside">
        <li v-for="rule in migrationDisabled" :key="rule.id">
          <button class="underline" @click="router.push(`/admin/rules-engine/${rule.id}/edit`)">{{ rule.name }}</button>
          <span class="text-surface-500"> — {{ rule.disabledReason }}</span>
        </li>
      </ul>
    </Message>

    <Message v-if="reconciliationStatus?.dirty" severity="info" :closable="false" class="mb-3">
      {{ t('rulesEngineList.dirtyWarning') }}
    </Message>
    <p v-if="reconciliationStatus?.lastRunAt" class="text-xs text-surface-500 mb-3">
      {{ t('rulesEngineList.lastRun', { date: formatRunDate(reconciliationStatus.lastRunAt) }) }}
    </p>

    <Message v-if="error" severity="error" :closable="true">{{ error }}</Message>

    <div class="flex flex-wrap gap-3 mb-4">
      <Select
        v-model="filters.type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('rulesEngineList.filterType')"
        show-clear
        class="w-48"
        @change="reload"
      />
      <Select
        v-model="filters.scope"
        :options="scopeOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('rulesEngineList.filterScope')"
        show-clear
        class="w-48"
        @change="reload"
      />
      <Select
        v-model="filters.isActive"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('common.status')"
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
      <Column field="name" :header="t('common.name')" sortable>
        <template #body="{ data }">
          <span class="font-semibold">{{ data.name }}</span>
        </template>
      </Column>

      <Column field="type" :header="t('rulesEngineList.colType')" sortable>
        <template #body="{ data }">
          <Tag :severity="data.type === 'badge' ? 'warn' : 'info'" :value="typeLabel(data.type)" />
        </template>
      </Column>

      <Column field="triggerEvent" :header="t('rulesEngineList.colEvent')" sortable />

      <Column field="scope" :header="t('rulesEngineList.colScope')" sortable>
        <template #body="{ data }">{{ scopeLabel(data.scope) }}</template>
      </Column>

      <Column field="priority" :header="t('rulesEngineList.colPriority')" sortable />

      <Column field="isActive" :header="t('rulesEngineList.colActive')" sortable>
        <template #body="{ data }">
          <div class="flex items-center gap-2">
            <Tag :severity="data.isActive ? 'success' : 'secondary'" :value="data.isActive ? t('rulesEngineList.yes') : t('rulesEngineList.no')" />
            <i
              v-if="data.disabledReason"
              class="fa fa-triangle-exclamation text-red-500"
              v-tooltip.top="data.disabledReason"
            />
          </div>
        </template>
      </Column>

      <Column :header="t('common.actions')" style="width: 11rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="router.push(`/admin/rules-engine/${data.id}/edit`)"
              v-tooltip.top="t('common.edit')"
            />
            <Button
              icon="fa fa-copy"
              size="small"
              text
              rounded
              :disabled="loading"
              @click="handleDuplicate(data)"
              v-tooltip.top="t('rulesEngineList.tooltipDuplicate')"
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
          <p class="text-gray-500 mb-4">{{ t('rulesEngineList.empty') }}</p>
          <Button :label="t('rulesEngineList.createRule')" icon="fa fa-plus" @click="router.push('/admin/rules-engine/new')" />
        </div>
      </template>
    </DataTable>

    <Dialog v-model:visible="deleteDialogVisible" :header="t('rulesEngineList.deleteDialogTitle')" :modal="true" :style="{ width: '450px' }">
      <div class="flex items-center gap-3 mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-orange-500"></i>
        <span>{{ t('rulesEngineList.deleteConfirm', { name: ruleToDelete?.name }) }}</span>
      </div>
      <Message
        v-if="ruleToDelete?.type === 'badge' && badgeHolderCount > 0"
        severity="warn"
        :closable="false"
        class="mb-2"
      >
        {{ t('rulesEngineList.badgeHolderWarning', { count: badgeHolderCount }) }}
      </Message>
      <template #footer>
        <Button :label="t('common.cancel')" icon="pi pi-times" @click="deleteDialogVisible = false" text />
        <Button :label="t('common.delete')" icon="pi pi-check" severity="danger" :loading="loading" @click="handleDelete" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useRulesService } from '@/composables/rules/rules.service'
import type { ClientRule, CreateRuleData } from '@skol-arena/shared/types/index'

const router = useRouter()
const { t } = useI18n()
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

/**
 * Rules the engine migration deactivated. Derived from the loaded list, so an active
 * filter can hide them — acceptable because no filter is applied by default, which is
 * when an admin would run into them.
 */
const migrationDisabled = computed(() => rules.value.filter((rule) => rule.disabledReason))

const filters = reactive<{ type?: 'message' | 'badge'; scope?: 'global' | 'discipline'; isActive?: boolean }>({})

const typeOptions = [
  { label: t('rulesEngineList.typeMessage'), value: 'message' },
  { label: t('rulesEngineList.typeBadge'), value: 'badge' },
]
const scopeOptions = [
  { label: t('rulesEngineList.scopeGlobal'), value: 'global' },
  { label: t('common.discipline'), value: 'discipline' },
]
const statusOptions = [
  { label: t('rulesEngineList.statusActive'), value: true },
  { label: t('rulesEngineList.statusInactive'), value: false },
]

const deleteDialogVisible = ref(false)
const ruleToDelete = ref<ClientRule | null>(null)
const badgeHolderCount = ref(0)

function typeLabel(type: string) {
  return type === 'badge' ? t('rulesEngineList.typeBadge') : t('rulesEngineList.typeMessage')
}
function scopeLabel(scope: string) {
  return scope === 'discipline' ? t('common.discipline') : t('rulesEngineList.scopeGlobal')
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
    summary: ok ? t('rulesEngineList.recalcLaunchedSummary') : t('rulesEngineList.errorSummary'),
    detail: ok
      ? t('rulesEngineList.recalcDetail')
      : t('rulesEngineList.recalcErrorDetail'),
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
    name: t('rulesEngineList.copyName', { name: rule.name }),
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
