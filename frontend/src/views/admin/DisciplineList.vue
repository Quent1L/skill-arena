<template>
  <div class="discipline-list-view p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Gestion des disciplines</h1>
      <Button
        label="Nouvelle discipline"
        icon="fa fa-plus"
        @click="router.push('/admin/disciplines/new')"
      />
    </div>

    <Message v-if="error" severity="error" :closable="true">
      {{ error }}
    </Message>

    <DataTable
      :value="disciplines"
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
          <router-link
            :to="`/admin/disciplines/${data.id}`"
            class="text-primary hover:underline font-semibold"
          >
            {{ data.name }}
          </router-link>
        </template>
      </Column>

      <Column header="Actions" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="router.push(`/admin/disciplines/${data.id}`)"
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
          <p class="text-gray-500 mb-4">Aucune discipline trouvée</p>
          <Button
            label="Créer votre première discipline"
            icon="fa fa-plus"
            @click="router.push('/admin/disciplines/new')"
          />
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="deleteDialogVisible"
      :header="`Supprimer ${disciplineToDelete?.name}?`"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex items-center gap-3 mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span>
          Êtes-vous sûr de vouloir supprimer cette discipline ? Cette action est irréversible.
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
import { useDisciplineService } from '@/composables/discipline/discipline.service'
import type { Discipline } from '@skill-arena/shared/types/discipline'

const router = useRouter()
const { disciplines, loading, error, listDisciplines, deleteDiscipline } = useDisciplineService()

const deleteDialogVisible = ref(false)
const disciplineToDelete = ref<Discipline | null>(null)

function confirmDelete(discipline: Discipline) {
  disciplineToDelete.value = discipline
  deleteDialogVisible.value = true
}

async function handleDelete() {
  if (!disciplineToDelete.value) return

  try {
    await deleteDiscipline(disciplineToDelete.value.id)
    deleteDialogVisible.value = false
    disciplineToDelete.value = null
    await listDisciplines()
  } catch (err) {
    console.error('Erreur lors de la suppression:', err)
  }
}

onMounted(() => {
  listDisciplines()
})
</script>

<style scoped>
.discipline-list-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
