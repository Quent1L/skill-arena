<template>
  <div class="discipline-list-view p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">{{ t('disciplineList.title') }}</h1>
      <Button
        :label="t('disciplineList.newDiscipline')"
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
      <Column field="name" :header="t('common.name')" sortable>
        <template #body="{ data }">
          <div class="flex items-center gap-2">
            <router-link
              :to="`/admin/disciplines/${data.id}`"
              class="text-primary hover:underline font-semibold"
            >
              {{ data.name }}
            </router-link>
            <Tag
              v-if="data.archivedAt"
              severity="secondary"
              :value="t('disciplineList.archivedTag')"
            />
          </div>
        </template>
      </Column>

      <Column :header="t('common.actions')" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="router.push(`/admin/disciplines/${data.id}`)"
              v-tooltip.top="t('common.edit')"
            />
            <Button
              v-if="data.archivedAt"
              icon="fa fa-rotate-left"
              size="small"
              text
              rounded
              @click="handleRestore(data)"
              v-tooltip.top="t('disciplineList.restore')"
            />
            <Button
              v-else
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
          <p class="text-gray-500 mb-4">{{ t('disciplineList.emptyState') }}</p>
          <Button
            :label="t('disciplineList.createFirst')"
            icon="fa fa-plus"
            @click="router.push('/admin/disciplines/new')"
          />
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="deleteDialogVisible"
      :header="t('disciplineList.deleteDialogHeader', { name: disciplineToDelete?.name })"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex items-start gap-3 mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
        <span>
          {{ t('disciplineList.deleteConfirmMessage') }}
        </span>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" icon="pi pi-times" @click="deleteDialogVisible = false" text />
        <Button
          :label="t('common.delete')"
          icon="fa fa-trash"
          @click="handleDelete"
          severity="danger"
          text
          :loading="loading"
        />
        <Button
          :label="t('disciplineList.archive')"
          icon="fa fa-box-archive"
          @click="handleArchive"
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
import { useDisciplineService } from '@/composables/discipline/discipline.service'
import type { Discipline } from '@skol-arena/shared/types/discipline'

const { t } = useI18n()
const router = useRouter()
const {
  disciplines,
  loading,
  error,
  listDisciplines,
  deleteDiscipline,
  archiveDiscipline,
  restoreDiscipline,
} = useDisciplineService()

const deleteDialogVisible = ref(false)
const disciplineToDelete = ref<Discipline | null>(null)

function confirmDelete(discipline: Discipline) {
  disciplineToDelete.value = discipline
  deleteDialogVisible.value = true
}

/**
 * A discipline referenced by a tournament, a rule or a match answers 409 with the
 * blocking resources. The toast carries that message; the dialog stays open so
 * archiving is one click away.
 */
async function handleDelete() {
  if (!disciplineToDelete.value) return

  try {
    await deleteDiscipline(disciplineToDelete.value.id)
    closeDialog()
    await refresh()
  } catch {
    // Handled by the service toast, which names the blocking resources.
  }
}

async function handleArchive() {
  if (!disciplineToDelete.value) return

  try {
    await archiveDiscipline(disciplineToDelete.value.id)
    closeDialog()
    await refresh()
  } catch {
    // Handled by the service toast.
  }
}

async function handleRestore(discipline: Discipline) {
  try {
    await restoreDiscipline(discipline.id)
    await refresh()
  } catch {
    // Handled by the service toast.
  }
}

function closeDialog() {
  deleteDialogVisible.value = false
  disciplineToDelete.value = null
}

/** Archived disciplines stay listed here, greyed by their tag, so they can be restored. */
function refresh() {
  return listDisciplines(true)
}

onMounted(refresh)
</script>

<style scoped>
.discipline-list-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
