<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8 text-white">
        <h1 class="text-4xl font-bold">Skol</h1>
        <p class="mt-2">Nouveau mot de passe</p>
      </div>

      <Card>
        <template #content>
          <div v-if="!tokenValid">
            <Message severity="error" :closable="false">
              Le lien de réinitialisation est invalide ou a expiré.
            </Message>
            <div class="text-center mt-4">
              <Button label="Demander un nouveau lien" @click="router.push('/forgot-password')" />
            </div>
          </div>

          <div v-else-if="!resetSuccess">
            <p class="text-gray-700 mb-6">Choisissez un nouveau mot de passe sécurisé.</p>

            <form @submit="onSubmit" class="space-y-6">
              <div class="flex flex-col gap-2">
                <label for="password" class="font-medium">Nouveau mot de passe</label>
                <Password
                  id="password"
                  v-model="password"
                  :feedback="true"
                  toggle-mask
                  :disabled="loading"
                  :invalid="!!errors.password"
                  class="w-full"
                  input-class="w-full"
                />
                <small v-if="errors.password" class="text-red-500">
                  {{ errors.password }}
                </small>
              </div>

              <div class="flex flex-col gap-2">
                <label for="passwordConfirm" class="font-medium"> Confirmer le mot de passe </label>
                <Password
                  id="passwordConfirm"
                  v-model="passwordConfirm"
                  :feedback="false"
                  toggle-mask
                  :disabled="loading"
                  :invalid="!!errors.passwordConfirm"
                  class="w-full"
                  input-class="w-full"
                />
                <small v-if="errors.passwordConfirm" class="text-red-500">
                  {{ errors.passwordConfirm }}
                </small>
              </div>

              <Message v-if="error" severity="error" :closable="false">
                {{ error }}
              </Message>

              <Button
                type="submit"
                :loading="loading"
                label="Réinitialiser le mot de passe"
                class="w-full"
                :disabled="loading"
              />
            </form>
          </div>

          <div v-else class="text-center py-4">
            <i class="fa fa-check-circle text-green-500 text-5xl mb-4"></i>
            <h3 class="text-xl font-semibold mb-2">Mot de passe réinitialisé !</h3>
            <p class="text-gray-700 mb-6">
              Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter
              avec votre nouveau mot de passe.
            </p>
            <Button label="Se connecter" @click="router.push('/login')" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { resetPasswordSchema } from '@/schemas/auth.schema'

const router = useRouter()
const route = useRoute()
const { resetPassword, loading, error } = useAuth()

const token = ref<string>('')
const tokenValid = ref(true)
const resetSuccess = ref(false)

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(resetPasswordSchema),
})

const [password] = defineField('password')
const [passwordConfirm] = defineField('passwordConfirm')

onMounted(() => {
  // Extract token from URL query parameter
  token.value = (route.query.token as string) || ''

  if (!token.value) {
    tokenValid.value = false
  }
})

const onSubmit = handleSubmit(async (values) => {
  try {
    await resetPassword(token.value, values.password)
    resetSuccess.value = true
  } catch (err) {
    console.error('Erreur de réinitialisation:', err)
    // If error indicates invalid token, update tokenValid
    if (error.value?.includes('invalide') || error.value?.includes('expiré')) {
      tokenValid.value = false
    }
  }
})
</script>
