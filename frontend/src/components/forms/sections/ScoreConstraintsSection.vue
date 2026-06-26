<template>
  <div class="score-constraints-section">
    <h2 class="text-xl font-semibold mb-4">{{ t('scoreConstraintsSection.title') }}</h2>

    <div class="flex items-center gap-3 mb-4">
      <ToggleSwitch
        v-model="scoreEnabled"
        :disabled="!canEdit('scoreEnabled')"
        input-id="scoreEnabled"
      />
      <label for="scoreEnabled" class="text-sm font-medium cursor-pointer">
        {{ t('scoreConstraintsSection.fields.scoreEnabled') }}
      </label>
    </div>

    <div v-if="scoreEnabled !== false" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="minScore" class="block text-sm font-medium mb-2">{{ t('scoreConstraintsSection.fields.minScore') }}</label>
        <InputNumber
          id="minScore"
          v-model="minScore"
          :min="0"
          :disabled="!canEdit('minScore')"
          :placeholder="t('scoreConstraintsSection.placeholders.noLimit')"
          class="w-full"
          :class="{ 'p-invalid': minScoreError }"
          :show-buttons="false"
        />
        <small class="p-error">{{ minScoreError }}</small>
      </div>
      <div>
        <label for="maxScore" class="block text-sm font-medium mb-2">{{ t('scoreConstraintsSection.fields.maxScore') }}</label>
        <InputNumber
          id="maxScore"
          v-model="maxScore"
          :min="0"
          :disabled="!canEdit('maxScore')"
          :placeholder="t('scoreConstraintsSection.placeholders.noLimit')"
          class="w-full"
          :class="{ 'p-invalid': maxScoreError }"
          :show-buttons="false"
        />
        <small class="p-error">{{ maxScoreError }}</small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useField } from 'vee-validate'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    editableFields?: string[]
  }>(),
  { editableFields: () => ['all'] },
)

const { value: scoreEnabled } = useField<boolean>('scoreEnabled')
const { value: minScore, errorMessage: minScoreError } =
  useField<number | null>('minScore')
const { value: maxScore, errorMessage: maxScoreError } =
  useField<number | null>('maxScore')

function canEdit(field: string): boolean {
  if (props.editableFields.includes('all')) return true
  return props.editableFields.includes(field)
}
</script>
