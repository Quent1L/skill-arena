<template>
  <div class="game-rules-list-view p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">{{ t('gameRulesList.title') }}</h1>
      <Button
        :label="t('gameRulesList.newRule')"
        icon="fa fa-plus"
        @click="router.push('/admin/rules/new')"
      />
    </div>

    <Message v-if="error" severity="error" :closable="true">
      {{ error }}
    </Message>

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
      <Column field="title" :header="t('gameRulesList.columnTitle')" sortable>
        <template #body="{ data }">
          <span class="font-semibold">{{ data.title }}</span>
        </template>
      </Column>

      <Column field="createdAt" :header="t('gameRulesList.columnCreatedAt')" sortable>
        <template #body="{ data }">
          {{ formatDate(data.createdAt) }}
        </template>
      </Column>

      <Column :header="t('common.actions')" style="width: 10rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="router.push(`/admin/rules/${data.id}/edit`)"
              v-tooltip.top="t('common.edit')"
            />
            <Button
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
          <p class="text-gray-500 mb-4">{{ t('gameRulesList.emptyState') }}</p>
          <Button
            :label="t('gameRulesList.createFirst')"
            icon="fa fa-plus"
            @click="router.push('/admin/rules/new')"
          />
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="deleteDialogVisible"
      :header="t('gameRulesList.deleteDialogHeader')"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex items-center gap-3 mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span>
          {{ t('gameRulesList.deleteConfirmMessage', { title: ruleToDelete?.title }) }}
        </span>
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
import { useI18n } from 'vue-i18n'
import { useGameRulesService } from '@/composables/game-rules/game-rules.service'
import type { ClientGameRule } from '@skill-arena/shared/types/index'

const { t } = useI18n()
const router = useRouter()
const { rules, loading, error, loadRules, deleteRule } = useGameRulesService()

const deleteDialogVisible = ref(false)
const ruleToDelete = ref<ClientGameRule | null>(null)

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function confirmDelete(rule: ClientGameRule) {
  ruleToDelete.value = rule
  deleteDialogVisible.value = true
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
})
</script>

<style scoped>
.game-rules-list-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
