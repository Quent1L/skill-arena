<template>
  <div class="validation-mode-section">
    <h2 class="text-xl font-semibold mb-4">Mode de validation des scores</h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div
        v-for="option in modeOptions"
        :key="option.value"
        class="cursor-pointer rounded-lg border-2 p-4 transition-colors"
        :class="
          validationMode === option.value
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-surface-200 dark:border-surface-700 hover:border-surface-400'
        "
        :role="canEdit ? 'button' : undefined"
        @click="canEdit ? setMode(option.value) : undefined"
      >
        <div class="flex items-center gap-2 mb-2">
          <i :class="['fa', option.icon, 'text-lg']" />
          <span class="font-semibold text-sm">{{ option.label }}</span>
          <Tag v-if="option.badge" :value="option.badge" severity="secondary" class="text-xs" />
        </div>
        <p class="text-xs text-surface-500 dark:text-surface-400">{{ option.description }}</p>
      </div>
    </div>

    <div v-if="validationMode === 'auto'" class="mt-3">
      <label for="validationTimerHours" class="block text-sm font-medium mb-2">
        Délai d'auto-validation (heures)
      </label>
      <InputNumber
        id="validationTimerHours"
        v-model="validationTimerHours"
        :min="1"
        :max="168"
        :disabled="!canEdit"
        placeholder="24"
        class="w-40"
        input-class="w-40"
        :show-buttons="true"
      />
      <p class="text-xs text-surface-500 mt-1">
        Si aucun adversaire ne conteste dans ce délai, le score est validé automatiquement.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useField } from 'vee-validate'
import type { ValidationMode } from '@skill-arena/shared/types/index'

const props = withDefaults(
  defineProps<{
    editableFields?: string[]
  }>(),
  { editableFields: () => ['all'] },
)

const { value: validationMode } = useField<ValidationMode>('validationMode')
const { value: validationTimerHours } = useField<number | null>('validationTimerHours')

const canEdit = props.editableFields.includes('all') || props.editableFields.includes('validationMode')

function setMode(mode: ValidationMode) {
  validationMode.value = mode
  if (mode !== 'auto') {
    validationTimerHours.value = null
  } else if (!validationTimerHours.value) {
    validationTimerHours.value = 24
  }
}

const modeOptions: { value: ValidationMode; label: string; icon: string; badge?: string; description: string }[] = [
  {
    value: 'auto',
    label: 'AUTO',
    icon: 'fa-bolt',
    badge: 'Détente',
    description:
      'Validation automatique après un délai. Trust Score actif : les joueurs fiables valident immédiatement.',
  },
  {
    value: 'strict',
    label: 'STRICT',
    icon: 'fa-shield-halved',
    badge: 'Compétition',
    description:
      "Un adversaire doit confirmer le score pour valider. Pas d'auto-validation.",
  },
  {
    value: 'admin',
    label: 'ADMIN',
    icon: 'fa-crown',
    badge: 'Officiel',
    description: 'Seul un administrateur peut valider les scores. Contrôle total.',
  },
]
</script>
