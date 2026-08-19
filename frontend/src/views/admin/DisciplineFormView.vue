<template>
  <div class="discipline-form-view p-4">
    <Message v-if="error" severity="error" :closable="true">
      {{ error }}
    </Message>

    <!-- Outcome types save as you edit them, so drift can appear at any moment
         and not just when the discipline form is submitted. This stays visible
         for as long as a running competition is out of step. -->
    <Message
      v-if="driftingCompetitionCount > 0"
      severity="warn"
      :closable="false"
      class="max-w-4xl mb-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>
          {{ t('disciplineFormView.driftBanner', { count: driftingCompetitionCount }) }}
        </span>
        <Button
          :label="t('disciplineFormView.reviewPropagation')"
          icon="fa fa-arrows-rotate"
          size="small"
          @click="propagateDialogVisible = true"
        />
      </div>
    </Message>

    <form @submit="onSubmit" class="max-w-4xl">
      <Card>
        <template #content>
          <!-- Informations de la discipline -->
          <div class="mb-6">
            <h2 class="text-xl font-semibold mb-4">{{ t('disciplineFormView.sectionInfo') }}</h2>

            <div class="grid grid-cols-1 gap-4">
              <div>
                <label for="name" class="block text-sm font-medium mb-2">
                  {{ t('disciplineFormView.nameLabel') }} <span class="text-red-500">*</span>
                </label>
                <InputText
                  id="name"
                  v-model="name"
                  class="w-full"
                  :class="{ 'p-invalid': errors.name }"
                />
                <small class="p-error">{{ errors.name }}</small>
              </div>
              <div>
                <label for="scoreInstructions" class="block text-sm font-medium mb-2">
                  {{ t('disciplineFormView.scoreInstructionsLabel') }}
                </label>
                <Textarea
                  id="scoreInstructions"
                  v-model="scoreInstructions"
                  class="w-full"
                  :rows="3"
                  :placeholder="t('disciplineFormView.scoreInstructionsPlaceholder')"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">
                  {{ t('disciplineFormView.iconLabel') }}
                </label>
                <FontAwesomeIconPicker v-model="icon" />
              </div>
              <div>
                <label for="teamInteractionMode" class="block text-sm font-medium mb-2">
                  {{ t('disciplineFormView.teamInteractionModeLabel') }}
                </label>
                <Select
                  id="teamInteractionMode"
                  v-model="teamInteractionMode"
                  :options="interactionModeOptions"
                  option-label="label"
                  option-value="value"
                  :placeholder="t('disciplineFormView.selectModePlaceholder')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.teamInteractionMode }"
                  show-clear
                />
                <small class="p-error">{{ errors.teamInteractionMode }}</small>
              </div>
            </div>
          </div>

          <!-- Outcome types (edit mode only) -->
          <OutcomeTypeTable
            v-if="isEditMode && currentDiscipline"
            :outcome-types="outcomeTypes"
            :outcome-reasons="outcomeReasons"
            :loading="loading"
            :load-outcome-reasons="loadOutcomeReasons"
            @add-outcome-type="showOutcomeTypeDialog()"
            @edit-outcome-type="showOutcomeTypeDialog"
            @delete-outcome-type="confirmDeleteOutcomeType"
            @restore-outcome-type="handleRestoreOutcomeType"
            @add-outcome-reason="showOutcomeReasonDialog"
            @edit-outcome-reason="(type, reason) => showOutcomeReasonDialog(type, reason)"
            @delete-outcome-reason="confirmDeleteOutcomeReason"
            ref="outcomeTypeTableRef"
          />

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              :label="t('common.cancel')"
              severity="secondary"
              @click="router.back()"
              :disabled="loading"
              class="w-full sm:w-auto"
            />
            <Button
              type="submit"
              :label="isEditMode ? t('common.update') : t('common.create')"
              icon="fa fa-check"
              :loading="loading"
              class="w-full sm:w-auto"
            />
          </div>
        </template>
      </Card>
    </form>

    <!-- Outcome Type Dialog -->
    <OutcomeTypeDialog
      v-model:visible="outcomeTypeDialogVisible"
      :editing="editingOutcomeType"
      :loading="loading"
      @submit="handleOutcomeTypeSubmit"
    />

    <!-- Push this discipline onto competitions that are still running -->
    <PropagateRulesetDialog
      ref="propagateDialogRef"
      v-model:visible="propagateDialogVisible"
      :discipline-id="(route.params.id as string) ?? null"
      @load="refreshDrift"
      @propagate="handlePropagate"
    />

    <!-- Outcome Reason Dialog -->
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
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import Textarea from 'primevue/textarea'
import {
  createDisciplineSchema,
  updateDisciplineSchema,
  type CreateDisciplineRequestData,
  type OutcomeType,
  type ImpactedCompetition,
} from '@skol-arena/shared/types/index'
import type { OutcomeReason } from '@skol-arena/shared/types/outcome-reason'
import { useDisciplineService } from '@/composables/discipline/discipline.service'
import { disciplineApi, type InteractionModeOption } from '@/composables/discipline/discipline.api'
import { useConfirm } from 'primevue/useconfirm'
import OutcomeTypeTable from './components/OutcomeTypeTable.vue'
import OutcomeTypeDialog from './components/OutcomeTypeDialog.vue'
import OutcomeReasonDialog from './components/OutcomeReasonDialog.vue'
import PropagateRulesetDialog from './components/PropagateRulesetDialog.vue'
import { useAppToast } from '@/composables/useAppToast'
import FontAwesomeIconPicker from '@/components/forms/FontAwesomeIconPicker.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const confirm = useConfirm()
const toast = useAppToast()
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
  archiveOutcomeType,
  restoreOutcomeType,
  loadOutcomeReasons,
  createOutcomeReason,
  updateOutcomeReason,
  deleteOutcomeReason,
} = useDisciplineService()

const isEditMode = computed(() => route.params.id !== 'new' && !!route.params.id)

// Discipline form
const { handleSubmit, defineField, errors, setValues } = useForm({
  validationSchema: toTypedSchema(
    isEditMode.value ? updateDisciplineSchema : createDisciplineSchema,
  ),
})

const [name] = defineField('name')
const [icon] = defineField('icon')
const [scoreInstructions] = defineField('scoreInstructions')
const [teamInteractionMode] = defineField('teamInteractionMode')

const interactionModeOptions = ref<InteractionModeOption[]>([])

// Outcome Types management
const outcomeTypeTableRef = ref<InstanceType<typeof OutcomeTypeTable> | null>(null)
const outcomeTypeDialogVisible = ref(false)
const editingOutcomeType = ref<OutcomeType | null>(null)

// Pushing a discipline edit onto competitions that are still running
const propagateDialogVisible = ref(false)
const propagateDialogRef = ref<InstanceType<typeof PropagateRulesetDialog> | null>(null)
const impactedCompetitions = ref<ImpactedCompetition[]>([])
const driftingCompetitionCount = computed(
  () => impactedCompetitions.value.filter((competition) => competition.hasDrift).length,
)

// Outcome Reasons management
const outcomeReasonDialogVisible = ref(false)
const editingOutcomeReason = ref<OutcomeReason | null>(null)
const currentOutcomeTypeForReason = ref<OutcomeType | null>(null)

function showOutcomeTypeDialog(outcomeType?: OutcomeType) {
  editingOutcomeType.value = outcomeType || null
  outcomeTypeDialogVisible.value = true
}

async function handleOutcomeTypeSubmit(values: {
  name: string
  isDefault: boolean
  points: number
  mmrMultiplier: number
  scoreCountsForMmr: boolean
}) {
  if (!currentDiscipline.value) return

  try {
    if (editingOutcomeType.value) {
      await updateOutcomeType(editingOutcomeType.value.id, {
        name: values.name,
        isDefault: values.isDefault,
        points: values.points,
        mmrMultiplier: values.mmrMultiplier,
        scoreCountsForMmr: values.scoreCountsForMmr,
      })
    } else {
      await createOutcomeType({
        disciplineId: currentDiscipline.value.id,
        name: values.name,
        isDefault: values.isDefault,
        points: values.points,
        mmrMultiplier: values.mmrMultiplier,
        scoreCountsForMmr: values.scoreCountsForMmr,
      })
    }

    outcomeTypeDialogVisible.value = false
    editingOutcomeType.value = null
    await refreshDrift()
  } catch (err) {
    console.error('Erreur lors de la sauvegarde du type de résultat:', err)
  }
}

function showOutcomeReasonDialog(outcomeType: OutcomeType, outcomeReason?: OutcomeReason) {
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

    // Reload reasons for this type
    await loadOutcomeReasons(outcomeTypeId)
    await refreshDrift()
  } catch (err) {
    console.error('Error saving outcome reason:', err)
  }
}

function confirmDeleteOutcomeType(outcomeType: OutcomeType) {
  confirm.require({
    message: t('disciplineFormView.confirmDeleteOutcomeTypeMessage'),
    header: t('disciplineFormView.confirmDeleteOutcomeTypeHeader'),
    icon: 'fa fa-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const idToDelete = outcomeType.id
      try {
        await deleteOutcomeType(idToDelete)
        // Remove from expandedRows if present
        if (outcomeTypeTableRef.value?.expandedRows[idToDelete]) {
          delete outcomeTypeTableRef.value.expandedRows[idToDelete]
        }
        await refreshDrift()
      } catch (err) {
        // A type nothing has been played under deletes cleanly. Once matches
        // reference it the backend refuses, and archiving is the way out — so
        // offer it rather than leaving the admin with a dead end.
        if ((err as Error)?.cause === 'OUTCOME_TYPE_IN_USE') {
          promptArchiveOutcomeType(outcomeType)
        }
      }
    },
  })
}

function promptArchiveOutcomeType(outcomeType: OutcomeType) {
  confirm.require({
    message: t('disciplineFormView.archiveOutcomeTypeMessage', { name: outcomeType.name }),
    header: t('disciplineFormView.archiveOutcomeTypeHeader'),
    icon: 'fa fa-box-archive',
    acceptLabel: t('disciplineFormView.archive'),
    accept: async () => {
      try {
        await archiveOutcomeType(outcomeType.id)
        await refreshDrift()
      } catch {
        // Handled by the service toast.
      }
    },
  })
}

async function handleRestoreOutcomeType(outcomeType: OutcomeType) {
  try {
    await restoreOutcomeType(outcomeType.id)
    await refreshDrift()
  } catch {
    // Handled by the service toast.
  }
}

function confirmDeleteOutcomeReason(outcomeReason: OutcomeReason) {
  confirm.require({
    message: t('disciplineFormView.confirmDeleteOutcomeReasonMessage'),
    header: t('disciplineFormView.confirmDeleteOutcomeReasonHeader'),
    icon: 'fa fa-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const outcomeTypeId = outcomeReason.outcomeTypeId
        await deleteOutcomeReason(outcomeReason.id)
        await loadOutcomeReasons(outcomeTypeId)
        await refreshDrift()
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
      await refreshDrift()
      // Leaving now would hide the banner the save may just have raised.
      if (driftingCompetitionCount.value > 0) return
    } else {
      await createDiscipline(values as CreateDisciplineRequestData)
    }
    router.push('/admin/disciplines')
  } catch (err) {
    console.error('Erreur lors de la sauvegarde:', err)
  }
})

/**
 * How many running competitions are out of step with this discipline.
 *
 * Recomputed after every mutation on this page, not only on submit: outcome
 * types are saved the moment they are edited, and their points and MMR
 * multiplier are the changes that matter most — tying the prompt to the
 * discipline's own save button would have missed all of them.
 */
async function refreshDrift() {
  if (!isEditMode.value || !route.params.id) return
  try {
    const impacted = await disciplineApi.listImpactedCompetitions(route.params.id as string)
    impactedCompetitions.value = impacted
    propagateDialogRef.value?.setCompetitions(impacted)
  } catch {
    // Never let the preflight break the page; the banner simply stays hidden.
    impactedCompetitions.value = []
  }
}

async function handlePropagate(tournamentIds: string[]) {
  if (!route.params.id) return
  try {
    const results = await disciplineApi.propagate(route.params.id as string, tournamentIds)
    const failed = results.filter((result) => result.status === 'failed').length
    toast.add({
      severity: failed > 0 ? 'warn' : 'success',
      summary: t('common.success'),
      detail:
        failed > 0
          ? t('propagateRuleset.partialSuccess', { failed, total: results.length })
          : t('propagateRuleset.success', { count: results.length }),
      life: 5000,
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: err instanceof Error ? err.message : t('propagateRuleset.failed'),
      life: 5000,
    })
  } finally {
    propagateDialogRef.value?.setSubmitted()
    propagateDialogVisible.value = false
    // Stay on the page: whatever was left unselected is still drifting, and the
    // banner has to keep saying so.
    await refreshDrift()
  }
}

onMounted(async () => {
  const [modes] = await Promise.all([
    disciplineApi.listInteractionModes(),
    isEditMode.value && route.params.id ? getDiscipline(route.params.id as string) : Promise.resolve(),
  ])
  interactionModeOptions.value = modes
  if (isEditMode.value && currentDiscipline.value) {
    setValues({
      name: currentDiscipline.value.name,
      icon: currentDiscipline.value.icon,
      scoreInstructions: currentDiscipline.value.scoreInstructions,
      teamInteractionMode: currentDiscipline.value.teamInteractionMode,
    })
    // Drift may already exist from an earlier visit that never propagated.
    await refreshDrift()
  }
})
</script>

<style scoped>
.discipline-form-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
