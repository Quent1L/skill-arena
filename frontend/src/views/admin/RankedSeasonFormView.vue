<template>
  <Toast />
  <div class="ranked-season-form-view p-4">
    <div class="flex items-center gap-3 mb-6">
      <Button icon="fa fa-arrow-left" text rounded @click="router.push('/admin/ranked')" />
      <h1 class="text-2xl font-bold">
        {{ isEditMode ? t('rankedSeasonFormView.editTitle') : t('rankedSeasonFormView.newTitle') }}
      </h1>
    </div>

    <Message v-if="error" severity="error" :closable="true" class="mb-4">
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
              :locked-discipline-name="currentSeason?.discipline?.name ?? ''"
              :description-placeholder="t('rankedSeasonFormView.descriptionPlaceholder')"
              :name-placeholder="t('rankedSeasonFormView.namePlaceholder')"
            />
          </div>

          <!-- Configuration Elo -->
          <div class="mb-6">
            <h2 class="text-xl font-semibold mb-4">{{ t('rankedSeasonFormView.eloConfigTitle') }}</h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label for="baseMmr" class="block text-sm font-medium mb-2">{{ t('rankedSeasonFormView.labelBaseMmr') }}</label>
                <InputNumber
                  id="baseMmr"
                  v-model="baseMmr"
                  :min="100"
                  :max="5000"
                  class="w-full"
                  :class="{ 'p-invalid': errors.baseMmr }"
                />
                <small class="p-error">{{ errors.baseMmr }}</small>
              </div>

              <div>
                <label for="kFactor" class="block text-sm font-medium mb-2">{{ t('rankedSeasonFormView.labelKFactor') }}</label>
                <InputNumber
                  id="kFactor"
                  v-model="kFactor"
                  :min="8"
                  :max="128"
                  class="w-full"
                  :class="{ 'p-invalid': errors.kFactor }"
                />
                <small class="p-error">{{ errors.kFactor }}</small>
              </div>

              <div>
                <label for="placementMatches" class="block text-sm font-medium mb-2">
                  {{ t('rankedSeasonFormView.labelPlacementMatches') }}
                </label>
                <InputNumber
                  id="placementMatches"
                  v-model="placementMatches"
                  :min="0"
                  :max="20"
                  class="w-full"
                  :class="{ 'p-invalid': errors.placementMatches }"
                />
                <small class="p-error">{{ errors.placementMatches }}</small>
              </div>
            </div>

            <div class="flex flex-col gap-3 mt-4">
              <div class="flex items-center gap-2">
                <Checkbox id="usePreviousMmr" v-model="usePreviousMmr" :binary="true" />
                <label for="usePreviousMmr" class="text-sm">
                  {{ t('rankedSeasonFormView.labelUsePreviousMmr') }}
                </label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox
                  id="allowAsymmetricMatches"
                  v-model="allowAsymmetricMatches"
                  :binary="true"
                />
                <label for="allowAsymmetricMatches" class="text-sm">
                  {{ t('rankedSeasonFormView.labelAllowAsymmetricMatches') }}
                </label>
              </div>
            </div>

            <div class="mt-4">
              <label for="sourceTierSeasonId" class="block text-sm font-medium mb-2">
                {{ t('rankedSeasonFormView.labelSourceTierSeasonId') }}
              </label>
              <Select
                id="sourceTierSeasonId"
                v-model="sourceTierSeasonId"
                :options="sourceTierOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('rankedSeasonFormView.placeholderSourceTierSeasonId')"
                class="w-full"
                show-clear
              />
              <small class="text-surface-400">
                {{ t('rankedSeasonFormView.helpSourceTierSeasonId') }}
              </small>
            </div>
          </div>

          <!-- Contraintes de score -->
          <div class="mb-6">
            <ScoreConstraintsSection />
          </div>

          <!-- Mode de validation -->
          <div class="mb-6">
            <ValidationModeSection />
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              :label="t('common.cancel')"
              severity="secondary"
              @click="router.push('/admin/ranked')"
              :disabled="loading"
              class="w-full sm:w-auto"
            />
            <Button
              type="submit"
              :label="isEditMode ? t('common.update') : t('rankedSeasonFormView.createSeason')"
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
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useI18n } from 'vue-i18n'
import { useAppToast } from '@/composables/useAppToast'
import {
  type CreateRankedSeasonFormData,
  type UpdateRankedSeasonFormData,
  createRankedSeasonFormSchema,
  updateRankedSeasonFormSchema,
} from '@skol-arena/shared/types/index'
import { useRankedService } from '@/composables/ranked/ranked.service'
import { useFormReferences } from '@/composables/useFormReferences'
import { useAuth } from '@/composables/useAuth'
import GeneralInfoSection from '@/components/forms/sections/GeneralInfoSection.vue'
import ScoreConstraintsSection from '@/components/forms/sections/ScoreConstraintsSection.vue'
import ValidationModeSection from '@/components/forms/sections/ValidationModeSection.vue'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const {
  currentSeason,
  finishedSeasons,
  loading,
  error,
  loadSeasonById,
  createSeason,
  updateSeason,
  loadFinishedSeasons,
} = useRankedService()

const {
  organizations,
  disciplineOptions,
  rulesOptions,
  loadAll: loadFormReferences,
} = useFormReferences()
const { isSuperAdmin } = useAuth()

const isEditMode = computed(() => !!route.params.id && route.params.id !== 'new')

const toast = useAppToast()

const { handleSubmit, defineField, setValues, errors } = useForm({
  validationSchema: toTypedSchema(
    isEditMode.value ? updateRankedSeasonFormSchema : createRankedSeasonFormSchema,
  ),
})

const [baseMmr] = defineField('baseMmr')
const [kFactor] = defineField('kFactor')
const [placementMatches] = defineField('placementMatches')
const [usePreviousMmr] = defineField('usePreviousMmr')
const [allowAsymmetricMatches] = defineField('allowAsymmetricMatches')
const [sourceTierSeasonId] = defineField('sourceTierSeasonId')

const currentSeasonId = computed(() => (isEditMode.value ? (route.params.id as string) : null))
const sourceTierOptions = computed(() =>
  finishedSeasons.value
    .filter((s) => s.id !== currentSeasonId.value)
    .map((s) => {
      const disciplineSuffix = s.discipline ? ` — ${s.discipline.name}` : ''
      return { label: `${s.name}${disciplineSuffix}`, value: s.id }
    }),
)

const fieldLabels: Record<string, string> = {
  name: t('rankedSeasonFormView.fieldName'),
  disciplineId: t('rankedSeasonFormView.fieldDisciplineId'),
  startDate: t('rankedSeasonFormView.fieldStartDate'),
  endDate: t('rankedSeasonFormView.fieldEndDate'),
  minTeamSize: t('rankedSeasonFormView.fieldMinTeamSize'),
  maxTeamSize: t('rankedSeasonFormView.fieldMaxTeamSize'),
  baseMmr: t('rankedSeasonFormView.labelBaseMmr'),
  kFactor: t('rankedSeasonFormView.labelKFactor'),
  placementMatches: t('rankedSeasonFormView.labelPlacementMatches'),
  minScore: t('rankedSeasonFormView.fieldMinScore'),
  maxScore: t('rankedSeasonFormView.fieldMaxScore'),
  validationMode: t('rankedSeasonFormView.fieldValidationMode'),
}

const onSubmit = handleSubmit(
  async (values) => {
    if (isEditMode.value) {
      const id = route.params.id as string
      const success = await updateSeason(id, values as UpdateRankedSeasonFormData)
      if (success) router.push('/admin/ranked')
    } else {
      const season = await createSeason(values as CreateRankedSeasonFormData)
      if (season) router.push('/admin/ranked')
    }
  },
  ({ errors: formErrors }) => {
    const errs = formErrors as Record<string, string>
    const detail = Object.keys(errs)
      .map((k) => `• ${fieldLabels[k] ?? k}: ${errs[k]}`)
      .join('\n')
    toast.add({ severity: 'error', summary: t('rankedSeasonFormView.invalidFieldsTitle'), detail, life: 8000 })
  },
)

onMounted(async () => {
  await Promise.all([loadFormReferences(), loadFinishedSeasons()])
  if (isEditMode.value) {
    const id = route.params.id as string
    await loadSeasonById(id)
    if (currentSeason.value) {
      const s = currentSeason.value
      setValues({
        name: s.name,
        description: s.description ?? '',
        disciplineId: s.disciplineId,
        startDate: s.startDate ? new Date(s.startDate) : undefined,
        endDate: s.endDate ? new Date(s.endDate) : undefined,
        minTeamSize: s.minTeamSize,
        maxTeamSize: s.maxTeamSize,
        rulesId: s.rulesId ?? null,
        scoreEnabled: s.scoreEnabled ?? true,
        minScore: s.minScore ?? null,
        maxScore: s.maxScore ?? null,
        allowDraw: s.allowDraw ?? true,
        baseMmr: s.rankedConfig?.baseMmr ?? 1000,
        kFactor: s.rankedConfig?.kFactor ?? 32,
        placementMatches: s.rankedConfig?.placementMatches ?? 5,
        usePreviousMmr: s.rankedConfig?.usePreviousMmr ?? false,
        allowAsymmetricMatches: s.rankedConfig?.allowAsymmetricMatches ?? false,
        sourceTierSeasonId: s.rankedConfig?.sourceTierSeasonId ?? null,
        validationMode: (s.validationMode ?? 'strict') as 'none' | 'auto' | 'strict' | 'admin',
        validationTimerHours: s.validationTimerHours ?? null,
      })
    }
  } else {
    setValues({
      minTeamSize: 1,
      maxTeamSize: 2,
      baseMmr: 1000,
      kFactor: 32,
      placementMatches: 5,
      usePreviousMmr: false,
      allowAsymmetricMatches: false,
      scoreEnabled: true,
      allowDraw: true,
      validationMode: 'strict',
      validationTimerHours: null,
    })
  }
})
</script>

<style scoped>
.ranked-season-form-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
