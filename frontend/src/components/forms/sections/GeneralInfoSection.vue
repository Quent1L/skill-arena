<template>
  <div class="general-info-section">
    <h2 class="text-xl font-semibold mb-4">{{ t('generalInfoSection.title') }}</h2>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Nom -->
      <div>
        <label for="name" class="block text-sm font-medium mb-2">
          {{ t('generalInfoSection.fields.name') }} <span class="text-red-500">*</span>
        </label>
        <InputText
          id="name"
          v-model="name"
          :disabled="!canEdit('name')"
          class="w-full"
          :class="{ 'p-invalid': errors.name }"
          :placeholder="namePlaceholder"
        />
        <small class="p-error">{{ errors.name }}</small>
      </div>

      <!-- Discipline -->
      <div>
        <label for="disciplineId" class="block text-sm font-medium mb-2">
          {{ t('generalInfoSection.fields.discipline') }} <span class="text-red-500">*</span>
        </label>
        <Select
          v-if="!disciplineLocked"
          id="disciplineId"
          v-model="disciplineId"
          :options="disciplineOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('generalInfoSection.placeholders.discipline')"
          class="w-full"
          :class="{ 'p-invalid': errors.disciplineId }"
        />
        <InputText
          v-else
          id="disciplineId"
          :value="lockedDisciplineName"
          disabled
          class="w-full"
        />
        <small class="p-error">{{ errors.disciplineId }}</small>
      </div>

      <!-- Slot for extra fields at the top (tournament mode: status / mode / teamMode) -->
      <slot name="after-discipline" />

      <!-- Game rules -->
      <div>
        <label for="rulesId" class="block text-sm font-medium mb-2">{{ t('generalInfoSection.fields.rules') }}</label>
        <Select
          id="rulesId"
          v-model="rulesId"
          :options="rulesOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('generalInfoSection.placeholders.noRules')"
          :show-clear="true"
          class="w-full"
        />
      </div>

      <!-- Organisation (super admin) -->
      <div v-if="isSuperAdmin">
        <label for="organizationId" class="block text-sm font-medium mb-2">
          {{ t('generalInfoSection.fields.organization') }}
        </label>
        <Select
          id="organizationId"
          v-model="organizationId"
          :options="organizations"
          option-label="name"
          option-value="id"
          :placeholder="t('generalInfoSection.placeholders.noOrganization')"
          class="w-full"
          show-clear
        />
      </div>

      <!-- Description -->
      <div class="lg:col-span-2">
        <label for="description" class="block text-sm font-medium mb-2">{{ t('generalInfoSection.fields.description') }}</label>
        <RichTextEditor
          :model-value="description ?? ''"
          @update:model-value="description = $event"
          :disabled="!canEdit('description')"
        />
        <small class="p-error">{{ errors.description }}</small>
      </div>

      <!-- Slot for fields specific before team sizes (tournament mode) -->
      <slot name="before-team-size" />

      <!-- Min Team Size -->
      <div>
        <label for="minTeamSize" class="block text-sm font-medium mb-2">
          {{ t('generalInfoSection.fields.minTeamSize') }} <span class="text-red-500">*</span>
        </label>
        <InputNumber
          id="minTeamSize"
          v-model="minTeamSize"
          :min="1"
          :max="10"
          :disabled="!canEdit('minTeamSize')"
          class="w-full"
          :class="{ 'p-invalid': errors.minTeamSize }"
        />
        <small class="p-error">{{ errors.minTeamSize }}</small>
      </div>

      <!-- Max Team Size -->
      <div>
        <label for="maxTeamSize" class="block text-sm font-medium mb-2">
          {{ t('generalInfoSection.fields.maxTeamSize') }} <span class="text-red-500">*</span>
        </label>
        <InputNumber
          id="maxTeamSize"
          v-model="maxTeamSize"
          :min="1"
          :max="10"
          :disabled="!canEdit('maxTeamSize')"
          class="w-full"
          :class="{ 'p-invalid': errors.maxTeamSize }"
        />
        <small class="p-error">{{ errors.maxTeamSize }}</small>
      </div>

      <!-- Start date -->
      <div>
        <label for="startDate" class="block text-sm font-medium mb-2">
          {{ t('generalInfoSection.fields.startDate') }} <span class="text-red-500">*</span>
        </label>
        <DatePicker
          id="startDate"
          v-model="startDate"
          date-format="dd/mm/yy"
          :disabled="!canEdit('startDate')"
          class="w-full"
          :class="{ 'p-invalid': errors.startDate }"
        />
        <small class="p-error">{{ errors.startDate }}</small>
      </div>

      <!-- Date de fin -->
      <div>
        <label for="endDate" class="block text-sm font-medium mb-2">
          {{ t('generalInfoSection.fields.endDate') }} <span class="text-red-500">*</span>
        </label>
        <DatePicker
          id="endDate"
          v-model="endDate"
          date-format="dd/mm/yy"
          :disabled="!canEdit('endDate')"
          class="w-full"
          :class="{ 'p-invalid': errors.endDate }"
        />
        <small class="p-error">{{ errors.endDate }}</small>
      </div>
    </div>

    <!-- Allow Draw (always full width after the other fields) -->
    <div v-if="showAllowDraw" class="flex items-center py-4">
      <Checkbox
        id="allowDraw"
        v-model="allowDraw"
        :binary="true"
        :disabled="!canEdit('allowDraw')"
      />
      <label for="allowDraw" class="ml-2">{{ t('generalInfoSection.fields.allowDraw') }}</label>
    </div>

    <!-- Slot for extra fields at the bottom -->
    <slot name="footer" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useField } from 'vee-validate'
import type { OrganizationWithMemberCount } from '@skol-arena/shared'
import RichTextEditor from '@/components/editor/RichTextEditor.vue'

const { t } = useI18n()

interface SelectOption {
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    disciplineOptions: SelectOption[]
    rulesOptions: SelectOption[]
    organizations: OrganizationWithMemberCount[]
    isSuperAdmin: boolean
    disciplineLocked?: boolean
    lockedDisciplineName?: string
    descriptionPlaceholder?: string
    namePlaceholder?: string
    editableFields?: string[]
    showAllowDraw?: boolean
  }>(),
  {
    disciplineLocked: false,
    lockedDisciplineName: '',
    descriptionPlaceholder: '',
    namePlaceholder: '',
    editableFields: () => ['all'],
    showAllowDraw: true,
  },
)

const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: description, errorMessage: descriptionError } =
  useField<string>('description')
const { value: disciplineId, errorMessage: disciplineIdError } =
  useField<string>('disciplineId')
const { value: rulesId } = useField<string | null>('rulesId')
const { value: organizationId } = useField<string | null>('organizationId')
const { value: minTeamSize, errorMessage: minTeamSizeError } =
  useField<number>('minTeamSize')
const { value: maxTeamSize, errorMessage: maxTeamSizeError } =
  useField<number>('maxTeamSize')
const { value: startDate, errorMessage: startDateError } =
  useField<Date>('startDate')
const { value: endDate, errorMessage: endDateError } = useField<Date>('endDate')
const { value: allowDraw } = useField<boolean>('allowDraw')

const errors = computed(() => ({
  name: nameError.value,
  description: descriptionError.value,
  disciplineId: disciplineIdError.value,
  minTeamSize: minTeamSizeError.value,
  maxTeamSize: maxTeamSizeError.value,
  startDate: startDateError.value,
  endDate: endDateError.value,
}))

function canEdit(field: string): boolean {
  if (props.editableFields.includes('all')) return true
  return props.editableFields.includes(field)
}
</script>
