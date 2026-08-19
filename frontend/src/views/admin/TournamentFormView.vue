<template>
  <div class="tournament-form-view p-4">
    <Message v-if="error" severity="error" :closable="true">
      {{ error }}
    </Message>

    <form @submit="onSubmit" class="max-w-4xl">
      <Card>
        <template #content>
          <!-- General information -->
          <div class="mb-6">
            <GeneralInfoSection
              :discipline-options="disciplineOptions"
              :rules-options="rulesOptions"
              :organizations="organizations"
              :is-super-admin="isSuperAdmin"
              :discipline-locked="isEditMode"
              :locked-discipline-name="currentDisciplineName"
              :editability="editability"
            >
              <template #after-discipline>
                <!-- Status (edit mode only) -->
                <div v-if="isEditMode">
                  <label for="status" class="block text-sm font-medium mb-2">{{ t('common.status') }}</label>
                  <Select
                    id="status"
                    v-model="status"
                    :options="statusOptions"
                    option-label="label"
                    option-value="value"
                    :disabled="!isFieldEditable('status')"
                    class="w-full"
                    :class="{ 'p-invalid': errors.status }"
                  />
                  <small class="p-error">{{ errors.status }}</small>
                </div>
              </template>

              <template #before-team-size>
                <!-- Mode -->
                <div>
                  <label for="mode" class="block text-sm font-medium mb-2">
                    {{ t('tournamentFormView.labelMode') }} <span class="text-red-500">*</span>
                  </label>
                  <Select
                    id="mode"
                    v-model="mode"
                    :options="modeOptions"
                    option-label="label"
                    option-value="value"
                    :disabled="!isFieldEditable('mode')"
                    class="w-full"
                    :class="{ 'p-invalid': errors.mode }"
                  />
                  <small class="p-error">{{ errors.mode }}</small>
                </div>

                <!-- Team Mode -->
                <div>
                  <label for="teamMode" class="block text-sm font-medium mb-2">
                    {{ t('tournamentFormView.labelTeamMode') }} <span class="text-red-500">*</span>
                  </label>
                  <Select
                    id="teamMode"
                    v-model="teamMode"
                    :options="teamModeOptions"
                    option-label="label"
                    option-value="value"
                    :disabled="!isFieldEditable('teamMode')"
                    class="w-full"
                    :class="{ 'p-invalid': errors.teamMode }"
                  />
                  <small class="p-error">{{ errors.teamMode }}</small>
                </div>
              </template>
            </GeneralInfoSection>
          </div>

          <!-- Championship rules -->
          <div v-if="mode === 'championship'" class="mb-6">
            <h2 class="text-xl font-semibold mb-4">{{ t('tournamentFormView.championshipRulesTitle') }}</h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label for="maxMatchesPerPlayer" class="block text-sm font-medium mb-2">
                  {{ t('tournamentFormView.labelMaxMatchesPerPlayer') }}
                </label>
                <InputNumber
                  id="maxMatchesPerPlayer"
                  v-model="maxMatchesPerPlayer"
                  :min="CHAMPIONSHIP_LIMITS.maxMatchesPerPlayer.min"
                  :max="CHAMPIONSHIP_LIMITS.maxMatchesPerPlayer.max"
                  :disabled="!isFieldEditable('maxMatchesPerPlayer')"
                  class="w-full"
                />
                <FieldEditabilityNote :recalculates="fieldTriggersRecalculation('maxMatchesPerPlayer')" />
              </div>

              <div>
                <label for="maxTimesWithSamePartner" class="block text-sm font-medium mb-2">
                  {{ t('tournamentFormView.labelMaxTimesWithSamePartner') }}
                </label>
                <InputNumber
                  id="maxTimesWithSamePartner"
                  v-model="maxTimesWithSamePartner"
                  :min="CHAMPIONSHIP_LIMITS.maxTimesWithSamePartner.min"
                  :max="CHAMPIONSHIP_LIMITS.maxTimesWithSamePartner.max"
                  :disabled="!isFieldEditable('maxTimesWithSamePartner')"
                  class="w-full"
                />
              </div>

              <div>
                <label for="maxTimesWithSameOpponent" class="block text-sm font-medium mb-2">
                  {{ t('tournamentFormView.labelMaxTimesWithSameOpponent') }}
                </label>
                <InputNumber
                  id="maxTimesWithSameOpponent"
                  v-model="maxTimesWithSameOpponent"
                  :min="CHAMPIONSHIP_LIMITS.maxTimesWithSameOpponent.min"
                  :max="CHAMPIONSHIP_LIMITS.maxTimesWithSameOpponent.max"
                  :disabled="!isFieldEditable('maxTimesWithSameOpponent')"
                  class="w-full"
                />
              </div>

              <div>
                <label for="pointPerVictory" class="block text-sm font-medium mb-2">
                  {{ t('tournamentFormView.labelPointPerVictory') }}
                </label>
                <InputNumber
                  id="pointPerVictory"
                  v-model="pointPerVictory"
                  :min="0"
                  :disabled="!isFieldEditable('pointPerVictory')"
                  class="w-full"
                />
                <FieldEditabilityNote :recalculates="fieldTriggersRecalculation('pointPerVictory')" />
              </div>

              <div>
                <label for="pointPerDraw" class="block text-sm font-medium mb-2">
                  {{ t('tournamentFormView.labelPointPerDraw') }}
                </label>
                <InputNumber
                  id="pointPerDraw"
                  v-model="pointPerDraw"
                  :min="0"
                  :disabled="!isFieldEditable('pointPerDraw')"
                  class="w-full"
                />
                <FieldEditabilityNote :recalculates="fieldTriggersRecalculation('pointPerDraw')" />
              </div>

              <div>
                <label for="pointPerLoss" class="block text-sm font-medium mb-2">
                  {{ t('tournamentFormView.labelPointPerLoss') }}
                </label>
                <InputNumber
                  id="pointPerLoss"
                  v-model="pointPerLoss"
                  :min="0"
                  :disabled="!isFieldEditable('pointPerLoss')"
                  class="w-full"
                />
                <FieldEditabilityNote :recalculates="fieldTriggersRecalculation('pointPerLoss')" />
              </div>
            </div>
          </div>

          <!-- Contraintes de score -->
          <div class="mb-6">
            <ScoreConstraintsSection :editability="editability" />
          </div>

          <!-- Mode de validation -->
          <div class="mb-6">
            <ValidationModeSection :editability="editability" />
          </div>

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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useI18n } from 'vue-i18n'
import {
  type CreateTournamentFormData,
  type UpdateTournamentFormData,
  type TournamentEditability,
  baseTournamentFormSchema,
  baseTournamentUpdateFormSchema,
  CHAMPIONSHIP_DEFAULTS,
  CHAMPIONSHIP_LIMITS,
  SCORING_DEFAULTS,
  resolveChampionshipConfig,
  resolveScoringConfig,
} from '@skol-arena/shared/types/index'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useFormReferences } from '@/composables/useFormReferences'
import { useAuth } from '@/composables/useAuth'
import FieldEditabilityNote from '@/components/forms/FieldEditabilityNote.vue'
import GeneralInfoSection from '@/components/forms/sections/GeneralInfoSection.vue'
import ScoreConstraintsSection from '@/components/forms/sections/ScoreConstraintsSection.vue'
import ValidationModeSection from '@/components/forms/sections/ValidationModeSection.vue'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const {
  currentTournament,
  loading,
  error,
  getTournament,
  createTournament,
  updateTournament,
  getEditability,
} = useTournamentService()

const {
  organizations,
  disciplineOptions,
  rulesOptions,
  loadAll: loadFormReferences,
} = useFormReferences()
const { isSuperAdmin } = useAuth()

const isEditMode = computed(() => route.params.id !== 'new' && !!route.params.id)

/**
 * What the API will accept, fetched rather than guessed. A new tournament has no
 * constraints yet, so everything is open until we know otherwise.
 */
const editability = ref<TournamentEditability>({
  editable: [],
  recalculating: [],
  locked: [],
  enteredMatchCount: 0,
})

const currentDisciplineName = computed(
  () => currentTournament.value?.discipline?.name || t('tournamentFormView.undefinedDiscipline'),
)

const modeOptions = [
  { label: t('tournamentFormView.modeChampionship'), value: 'championship' },
  { label: t('tournamentFormView.modeBracket'), value: 'bracket' },
]

const teamModeOptions = [
  { label: t('tournamentFormView.teamModeStatic'), value: 'static' },
  { label: t('tournamentFormView.teamModeFlex'), value: 'flex' },
]

const statusOptions = [
  { label: t('tournamentFormView.statusDraft'), value: 'draft' },
  { label: t('tournamentFormView.statusOpen'), value: 'open' },
  { label: t('tournamentFormView.statusOngoing'), value: 'ongoing' },
  { label: t('tournamentFormView.statusFinished'), value: 'finished' },
]

const { handleSubmit, defineField, errors, setValues } = useForm({
  validationSchema: toTypedSchema(
    isEditMode.value ? baseTournamentUpdateFormSchema : baseTournamentFormSchema,
  ),
})

const [mode] = defineField('mode')
const [teamMode] = defineField('teamMode')
const [status] = defineField('status')
const [maxMatchesPerPlayer] = defineField('maxMatchesPerPlayer')
const [maxTimesWithSamePartner] = defineField('maxTimesWithSamePartner')
const [maxTimesWithSameOpponent] = defineField('maxTimesWithSameOpponent')
const [pointPerVictory] = defineField('pointPerVictory')
const [pointPerDraw] = defineField('pointPerDraw')
const [pointPerLoss] = defineField('pointPerLoss')
const [organizationId] = defineField('organizationId')

function isFieldEditable(fieldName: string): boolean {
  if (!isEditMode.value) return true
  return editability.value.editable.includes(fieldName)
}

/** Changing this field is allowed but rewrites results that are already published. */
function fieldTriggersRecalculation(fieldName: string): boolean {
  return isEditMode.value && editability.value.recalculating.includes(fieldName)
}

const onSubmit = handleSubmit(async (values) => {
  try {
    const formData = values as CreateTournamentFormData & UpdateTournamentFormData

    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      throw new Error(t('tournamentFormView.errorDateRange'))
    }

    if (
      formData.minTeamSize &&
      formData.maxTeamSize &&
      formData.maxTeamSize < formData.minTeamSize
    ) {
      throw new Error(t('tournamentFormView.errorTeamSize'))
    }

    if (isEditMode.value && route.params.id) {
      // Filtered against what the API actually accepts, so the form can never
      // send a field the server is about to refuse.
      const updateData = Object.entries(values).reduce(
        (acc, [key, value]) => {
          if (editability.value.editable.includes(key)) {
            acc[key] = value
          }
          return acc
        },
        {} as Record<string, unknown>,
      )
      await updateTournament(route.params.id as string, updateData as UpdateTournamentFormData)
    } else {
      await createTournament({
        ...(values as CreateTournamentFormData),
        organizationId: organizationId.value ?? undefined,
      })
    }
    router.push('/admin/tournaments')
  } catch (err) {
    console.error('Erreur lors de la sauvegarde:', err)
  }
})

onMounted(async () => {
  await loadFormReferences()

  if (isEditMode.value && route.params.id) {
    await getTournament(route.params.id as string)
    if (currentTournament.value) {
      editability.value = await getEditability(route.params.id as string)
      setValues({
        name: currentTournament.value.name,
        description: currentTournament.value.description,
        mode: currentTournament.value.mode,
        teamMode: currentTournament.value.teamMode,
        status: currentTournament.value.status,
        minTeamSize: currentTournament.value.minTeamSize,
        maxTeamSize: currentTournament.value.maxTeamSize,
        ...resolveChampionshipConfig(currentTournament.value.championshipConfig),
        ...resolveScoringConfig(currentTournament.value.scoringConfig),
        allowDraw: currentTournament.value.allowDraw ?? true,
        startDate: currentTournament.value.startDate,
        endDate: currentTournament.value.endDate,
        disciplineId: currentTournament.value.disciplineId,
        minScore: currentTournament.value.minScore ?? null,
        maxScore: currentTournament.value.maxScore ?? null,
        scoreEnabled: currentTournament.value.scoreEnabled ?? true,
        rulesId: currentTournament.value.rulesId ?? null,
        organizationId: currentTournament.value.organizationId ?? null,
        validationMode: currentTournament.value.validationMode ?? 'strict',
        validationTimerHours: currentTournament.value.validationTimerHours ?? null,
      })
    }
  } else {
    setValues({
      mode: 'championship',
      teamMode: 'flex',
      status: 'draft',
      minTeamSize: 1,
      maxTeamSize: 2,
      ...CHAMPIONSHIP_DEFAULTS,
      ...SCORING_DEFAULTS,
      allowDraw: true,
      scoreEnabled: true,
      validationMode: 'strict',
      validationTimerHours: null,
    })
  }
})
</script>

<style scoped>
.tournament-form-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
