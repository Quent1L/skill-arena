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
import type { OutcomeType } from '@skill-arena/shared/types/outcome-type'

interface Props {
  visible: boolean
  editing: OutcomeType | null
  loading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [values: { name: string }]
}>()

const formSchema = z.object({
  name: z
    .string({ message: "Le nom est requis" })
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
})

const { defineField, handleSubmit, errors, resetForm, setValues } = useForm({
  validationSchema: toTypedSchema(formSchema),
})

const [name] = defineField('name')

watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetForm()
    if (props.editing) {
      setValues({ name: props.editing.name })
    }
  }
})

const onSubmit = handleSubmit((values) => {
  emit('submit', values)
})
</script>

