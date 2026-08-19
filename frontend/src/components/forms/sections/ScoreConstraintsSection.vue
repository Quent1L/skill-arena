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
        <FieldEditabilityNote
          :locked-by-matches="lockedByMatches('scoreEnabled')"
          :match-count="enteredMatchCount"
        />
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
        <FieldEditabilityNote
          :locked-by-matches="lockedByMatches('minScore')"
          :match-count="enteredMatchCount"
        />
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
        <FieldEditabilityNote
          :locked-by-matches="lockedByMatches('maxScore')"
          :match-count="enteredMatchCount"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useField } from 'vee-validate'
import type { TournamentEditability } from '@skol-arena/shared/types/index'
import { useFieldEditability } from '@/composables/useFieldEditability'
import FieldEditabilityNote from '../FieldEditabilityNote.vue'

const { t } = useI18n()

const props = defineProps<{
  editability?: TournamentEditability | null
}>()

const { value: scoreEnabled } = useField<boolean>('scoreEnabled')
const { value: minScore, errorMessage: minScoreError } =
  useField<number | null>('minScore')
const { value: maxScore, errorMessage: maxScoreError } =
  useField<number | null>('maxScore')

const { canEdit, lockedByMatches, enteredMatchCount } = useFieldEditability(
  () => props.editability,
)
</script>
