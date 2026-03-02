<template>
  <div class="max-w-2xl mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Mon profil</h1>

    <Card>
      <template #title>
        <div class="flex items-center gap-2">
          <i class="fas fa-user-edit"></i>
          <span>Informations du profil</span>
        </div>
      </template>
      <template #content>
        <form @submit="onSubmit" class="space-y-4">
          <Message v-if="success" severity="success" :closable="false">
            <i class="fa fa-check mr-2"></i>
            Profil mis à jour avec succès.
          </Message>

          <div class="flex flex-col gap-2">
            <label for="display-name" class="font-medium">Nom d'affichage</label>
            <InputText
              id="display-name"
              v-model="displayName"
              :invalid="!!errors.displayName"
              :disabled="loading"
              class="w-full"
              maxlength="50"
            />
            <small v-if="errors.displayName" class="text-red-500">{{ errors.displayName }}</small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="short-name" class="font-medium">Nom court (classement)</label>
            <InputText
              id="short-name"
              v-model="shortName"
              :invalid="!!errors.shortName"
              :disabled="loading"
              class="w-full"
              maxlength="5"
              @input="shortName = (shortName ?? '').toUpperCase()"
            />
            <small class="opacity-60">Jusqu'à 5 caractères, affiché dans le classement à la place du nom complet.</small>
            <small v-if="errors.shortName" class="text-red-500">{{ errors.shortName }}</small>
          </div>

          <Message v-if="submitError" severity="error" :closable="false">
            {{ submitError }}
          </Message>

          <div class="flex justify-end gap-2 pt-2">
            <Button
              label="Annuler"
              severity="secondary"
              outlined
              type="button"
              :disabled="loading"
              @click="$router.back()"
            />
            <Button
              label="Enregistrer"
              type="submit"
              icon="fas fa-save"
              :loading="loading"
              :disabled="loading"
            />
          </div>
        </form>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { userApi } from '@/composables/user/user.api'

const profileSchema = z.object({
  displayName: z.string().min(1, 'Le nom est requis').max(50),
  shortName: z
    .string()
    .min(1, 'Le nom court est requis')
    .max(5, 'Maximum 5 caractères')
    .transform((v) => v.toUpperCase()),
})

const loading = ref(false)
const success = ref(false)
const submitError = ref<string | null>(null)

const { defineField, handleSubmit, errors, setValues } = useForm({
  validationSchema: toTypedSchema(profileSchema),
})

const [displayName] = defineField('displayName')
const [shortName] = defineField('shortName')

onMounted(async () => {
  try {
    const user = await userApi.me()
    setValues({ displayName: user.displayName, shortName: user.shortName })
  } catch {
    submitError.value = 'Impossible de charger le profil.'
  }
})

const onSubmit = handleSubmit(async (values) => {
  loading.value = true
  success.value = false
  submitError.value = null
  try {
    await userApi.updateProfile(values)
    success.value = true
  } catch {
    submitError.value = 'Une erreur est survenue lors de la mise à jour.'
  } finally {
    loading.value = false
  }
})
</script>
