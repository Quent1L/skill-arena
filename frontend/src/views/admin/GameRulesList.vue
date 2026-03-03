<template>
  <div class="game-rules-list-view p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Gestion des règles du jeu</h1>
      <Button
        label="Nouveau règlement"
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
      <Column field="title" header="Titre" sortable>
        <template #body="{ data }">
          <span class="font-semibold">{{ data.title }}</span>
        </template>
      </Column>

      <Column field="createdAt" header="Créé le" sortable>
        <template #body="{ data }">
          {{ formatDate(data.createdAt) }}
        </template>
      </Column>

      <Column header="Actions" style="width: 10rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="router.push(`/admin/rules/${data.id}/edit`)"
              v-tooltip.top="'Modifier'"
            />
            <Button
              icon="fa fa-trash"
              size="small"
              severity="danger"
              text
              rounded
              @click="confirmDelete(data)"
              v-tooltip.top="'Supprimer'"
            />
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="text-center py-8">
          <p class="text-gray-500 mb-4">Aucun règlement trouvé</p>
          <Button
            label="Créer votre premier règlement"
            icon="fa fa-plus"
            @click="router.push('/admin/rules/new')"
          />
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="deleteDialogVisible"
      :header="`Supprimer le règlement ?`"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex items-center gap-3 mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span>
          Êtes-vous sûr de vouloir supprimer <strong>{{ ruleToDelete?.title }}</strong> ? Cette action est irréversible.
        </span>
      </div>
      <template #footer>
        <Button label="Annuler" icon="pi pi-times" @click="deleteDialogVisible = false" text />
        <Button
          label="Supprimer"
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
import { useGameRulesService } from '@/composables/game-rules/game-rules.service'
import type { ClientGameRule } from '@skill-arena/shared/types/index'

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
