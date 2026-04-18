<template>
  <Dialog
    :visible="visible"
    :header="editing ? 'Modifier le type de résultat' : 'Ajouter un type de résultat'"
    :modal="true"
    :style="{ width: '500px' }"
    @update:visible="(val) => $emit('update:visible', val)"
  >
    <form @submit="onSubmit">
      <div class="mb-4">
        <label for="outcomeTypeName" class="block text-sm font-medium mb-2">
          Nom <span class="text-red-500">*</span>
        </label>
        <InputText
          id="outcomeTypeName"
          v-model="name"
          class="w-full"
          :class="{ 'p-invalid': errors.name }"
        />
        <small class="p-error">{{ errors.name }}</small>
      </div>
      <div class="mb-4">
        <label for="outcomeTypePoints" class="block text-sm font-medium mb-2">
          Points par résultat <span class="text-red-500">*</span>
        </label>
        <InputNumber
          id="outcomeTypePoints"
          v-model="points"
          class="w-full"
          :min="0"
          :class="{ 'p-invalid': errors.points }"
        />
        <small class="p-error">{{ errors.points }}</small>
      </div>
      <div class="flex items-center gap-3">
        <ToggleSwitch v-model="isDefault" input-id="isDefault" />
        <label for="isDefault" class="text-sm font-medium cursor-pointer">Type par défaut</label>
      </div>
    </form>
    <template #footer>
      <Button
        label="Annuler"
        icon="fa fa-times"
        @click="$emit('update:visible', false)"
        text
      />
      <Button
        label="Enregistrer"
        icon="fa fa-check"
        @click="onSubmit"
        :loading="loading"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import ToggleSwitch from 'primevue/toggleswitch'
import InputNumber from 'primevue/inputnumber'
import type { OutcomeType } from '@skill-arena/shared/types/outcome-type'

interface Props {
  visible: boolean
  editing: OutcomeType | null
  loading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [values: { name: string; isDefault: boolean; points: number }]
}>()

const formSchema = z.object({
  name: z
    .string({ message: "Le nom est requis" })
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  isDefault: z.boolean(),
  points: z.number().int().min(0),
})

const { defineField, handleSubmit, errors, resetForm, setValues } = useForm({
  validationSchema: toTypedSchema(formSchema),
  initialValues: { isDefault: false, points: 3 },
})

const [name] = defineField('name')
const [isDefault] = defineField('isDefault')
const [points] = defineField('points')

watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetForm({ values: { name: '', isDefault: false, points: 3 } })
    if (props.editing) {
      setValues({ name: props.editing.name, isDefault: props.editing.isDefault, points: props.editing.points })
    }
  }
})

const onSubmit = handleSubmit((values) => {
  emit('submit', { name: values.name, isDefault: values.isDefault ?? false, points: values.points ?? 3 })
})
</script>

