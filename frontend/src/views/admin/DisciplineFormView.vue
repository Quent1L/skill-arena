<template>
  <div class="discipline-form-view p-4">
    <Message v-if="error" severity="error" :closable="true">
      {{ error }}
    </Message>

    <form @submit="onSubmit" class="max-w-4xl">
      <Card>
        <template #content>
          <!-- Informations de la discipline -->
          <div class="mb-6">
            <h2 class="text-xl font-semibold mb-4">Informations de la discipline</h2>

            <div class="grid grid-cols-1 gap-4">
              <div>
                <label for="name" class="block text-sm font-medium mb-2">
                  Nom de la discipline <span class="text-red-500">*</span>
                </label>
                <InputText
                  id="name"
                  v-model="name"
                  class="w-full"
                  :class="{ 'p-invalid': errors.name }"
                />
                <small class="p-error">{{ errors.name }}</small>
              </div>
            </div>
          </div>

          <!-- Types de résultat (uniquement en mode édition) -->
          <OutcomeTypeTable
            v-if="isEditMode && currentDiscipline"
            :outcome-types="outcomeTypes"
            :outcome-reasons="outcomeReasons"
            :loading="loading"
            :load-outcome-reasons="loadOutcomeReasons"
            @add-outcome-type="showOutcomeTypeDialog()"
            @edit-outcome-type="showOutcomeTypeDialog"
            @delete-outcome-type="confirmDeleteOutcomeType"
            @add-outcome-reason="showOutcomeReasonDialog"
            @edit-outcome-reason="(type, reason) => showOutcomeReasonDialog(type, reason)"
            @delete-outcome-reason="confirmDeleteOutcomeReason"
            ref="outcomeTypeTableRef"
          />

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              label="Annuler"
              severity="secondary"
              @click="router.back()"
              :disabled="loading"
              class="w-full sm:w-auto"
            />
            <Button
              type="submit"
              :label="isEditMode ? 'Mettre à jour' : 'Créer'"
              icon="fa fa-check"
              :loading="loading"
              class="w-full sm:w-auto"
            />
          </div>
        </template>
      </Card>
    </form>

    <!-- Dialog pour Outcome Type -->
    <OutcomeTypeDialog
      v-model:visible="outcomeTypeDialogVisible"
      :editing="editingOutcomeType"
      :loading="loading"
      @submit="handleOutcomeTypeSubmit"
    />

    <!-- Dialog pour Outcome Reason -->
    <OutcomeReasonDialog
      v-model:visible="outcomeReasonDialogVisible"
      :editing="editingOutcomeReason"
      :loading="loading"
      @submit="handleOutcomeReasonSubmit"
    />

  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import {
  createDisciplineSchema,
  updateDisciplineSchema,
  type CreateDisciplineRequestData,
  type OutcomeType,
} from '@skill-arena/shared/types/index'
import { useDisciplineService } from '@/composables/discipline.service'
import type { OutcomeReasonResponse } from '@/composables/outcome-reason.api'
import { useConfirm } from 'primevue/useconfirm'
import OutcomeTypeTable from './components/OutcomeTypeTable.vue'
import OutcomeTypeDialog from './components/OutcomeTypeDialog.vue'
import OutcomeReasonDialog from './components/OutcomeReasonDialog.vue'

const router = useRouter()
const route = useRoute()
const confirm = useConfirm()
const {
  currentDiscipline,
  outcomeTypes,
  outcomeReasons,
  loading,
  error,
  getDiscipline,
  createDiscipline,
  updateDiscipline,
  createOutcomeType,
  updateOutcomeType,
  deleteOutcomeType,
  loadOutcomeReasons,
  createOutcomeReason,
  updateOutcomeReason,
  deleteOutcomeReason,
} = useDisciplineService()

const isEditMode = computed(() => route.params.id !== 'new' && !!route.params.id)

// Discipline form
const { handleSubmit, defineField, errors, setValues } = useForm({
  validationSchema: toTypedSchema(
    isEditMode.value ? updateDisciplineSchema : createDisciplineSchema
  ),
})

const [name] = defineField('name')

// Outcome Types management
const outcomeTypeTableRef = ref<InstanceType<typeof OutcomeTypeTable> | null>(null)
const outcomeTypeDialogVisible = ref(false)
const editingOutcomeType = ref<OutcomeType | null>(null)

// Outcome Reasons management
const outcomeReasonDialogVisible = ref(false)
const editingOutcomeReason = ref<OutcomeReasonResponse | null>(null)
const currentOutcomeTypeForReason = ref<OutcomeType | null>(null)

function showOutcomeTypeDialog(outcomeType?: OutcomeType) {
  editingOutcomeType.value = outcomeType || null
  outcomeTypeDialogVisible.value = true
}

async function handleOutcomeTypeSubmit(values: { name: string }) {
  if (!currentDiscipline.value) return

  try {
    if (editingOutcomeType.value) {
      await updateOutcomeType(editingOutcomeType.value.id, {
        name: values.name,
      })
    } else {
      await createOutcomeType({
        disciplineId: currentDiscipline.value.id,
        name: values.name,
      })
    }

    outcomeTypeDialogVisible.value = false
    editingOutcomeType.value = null
  } catch (err) {
    console.error('Erreur lors de la sauvegarde du type de résultat:', err)
  }
}

function showOutcomeReasonDialog(
  outcomeType: OutcomeType,
  outcomeReason?: OutcomeReasonResponse
) {
  editingOutcomeReason.value = outcomeReason || null
  currentOutcomeTypeForReason.value = outcomeType
  outcomeReasonDialogVisible.value = true
}

async function handleOutcomeReasonSubmit(values: { name: string }) {
  if (!currentOutcomeTypeForReason.value) return

  try {
    if (editingOutcomeReason.value) {
      await updateOutcomeReason(editingOutcomeReason.value.id, {
        name: values.name,
      })
    } else {
      await createOutcomeReason({
        outcomeTypeId: currentOutcomeTypeForReason.value.id,
        name: values.name,
      })
    }

    const outcomeTypeId = currentOutcomeTypeForReason.value.id
    outcomeReasonDialogVisible.value = false
    editingOutcomeReason.value = null
    currentOutcomeTypeForReason.value = null

    // Recharger les raisons pour ce type
    await loadOutcomeReasons(outcomeTypeId)
  } catch (err) {
    console.error('Erreur lors de la sauvegarde de la raison de résultat:', err)
  }
}

function confirmDeleteOutcomeType(outcomeType: OutcomeType) {
  confirm.require({
    message: 'Êtes-vous sûr de vouloir supprimer ce type de résultat ? Cette action est irréversible.',
    header: 'Supprimer le type de résultat ?',
    icon: 'fa fa-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const idToDelete = outcomeType.id
        await deleteOutcomeType(idToDelete)
        // Supprimer de expandedRows si présent
        if (outcomeTypeTableRef.value?.expandedRows[idToDelete]) {
          delete outcomeTypeTableRef.value.expandedRows[idToDelete]
        }
      } catch (err) {
        console.error('Erreur lors de la suppression:', err)
      }
    },
  })
}

function confirmDeleteOutcomeReason(outcomeReason: OutcomeReasonResponse) {
  confirm.require({
    message: 'Êtes-vous sûr de vouloir supprimer cette raison de résultat ? Cette action est irréversible.',
    header: 'Supprimer la raison de résultat ?',
    icon: 'fa fa-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const outcomeTypeId = outcomeReason.outcomeTypeId
        await deleteOutcomeReason(outcomeReason.id)
        await loadOutcomeReasons(outcomeTypeId)
      } catch (err) {
        console.error('Erreur lors de la suppression:', err)
      }
    },
  })
}

const onSubmit = handleSubmit(async (values) => {
  try {
    if (isEditMode.value && route.params.id) {
      await updateDiscipline(route.params.id as string, values)
    } else {
      await createDiscipline(values as CreateDisciplineRequestData)
    }
    router.push('/admin/disciplines')
  } catch (err) {
    console.error('Erreur lors de la sauvegarde:', err)
  }
})

onMounted(async () => {
  if (isEditMode.value && route.params.id) {
    await getDiscipline(route.params.id as string)
    if (currentDiscipline.value) {
      setValues({
        name: currentDiscipline.value.name,
      })
    }
  }
})
</script>

<style scoped>
.discipline-form-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>

