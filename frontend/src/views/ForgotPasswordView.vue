<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8 text-white">
        <h1 class="text-4xl font-bold">Skol</h1>
        <p class="mt-2">Réinitialisation de mot de passe</p>
      </div>

      <Card>
        <template #content>
          <div v-if="!submitted">
            <p class="text-gray-700 mb-6">
              Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot
              de passe.
            </p>

            <form @submit="onSubmit" class="space-y-6">
              <div class="flex flex-col gap-2">
                <label for="email" class="font-medium">Adresse email</label>
                <InputText
                  id="email"
                  v-model="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  :disabled="loading"
                  :invalid="!!errors.email"
                  class="w-full"
                />
                <small v-if="errors.email" class="text-red-500">
                  {{ errors.email }}
                </small>
              </div>

              <Message v-if="error" severity="error" :closable="false">
                {{ error }}
              </Message>

              <div class="space-y-3">
                <Button
                  type="submit"
                  :loading="loading"
                  label="Envoyer le lien de réinitialisation"
                  class="w-full"
                  :disabled="loading"
                />

                <div class="text-center text-sm">
                  <Button
                    link
                    label="← Retour à la connexion"
                    @click="router.push('/login')"
                    class="text-gray-600"
                  />
                </div>
              </div>
            </form>
          </div>

          <div v-else class="text-center py-4">
            <i class="fa fa-check-circle text-green-500 text-5xl mb-4"></i>
            <h3 class="text-xl font-semibold mb-2">Email envoyé !</h3>
            <p class="text-gray-700 mb-6">
              Si un compte existe avec cette adresse email, vous recevrez un lien de
              réinitialisation dans quelques instants.
            </p>
            <p class="text-sm text-gray-600 mb-6">
              Vérifiez également votre dossier spam si vous ne voyez pas l'email.
            </p>
            <Button label="Retour à la connexion" @click="router.push('/login')" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { forgotPasswordSchema } from '@/schemas/auth.schema'

const router = useRouter()
const { requestPasswordReset, loading, error } = useAuth()
const submitted = ref(false)

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(forgotPasswordSchema),
})

const [email] = defineField('email')

const onSubmit = handleSubmit(async (values) => {
  try {
    await requestPasswordReset(values.email)
    submitted.value = true
  } catch (err) {
    console.error('Erreur de demande de réinitialisation:', err)
  }
})
</script>
