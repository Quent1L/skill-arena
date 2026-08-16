<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8 text-white">
        <SkolLogo :width="240" class="mx-auto" />
        <p class="mt-2">{{ t('forgotPasswordView.subtitle') }}</p>
      </div>

      <Card>
        <template #content>
          <div v-if="!submitted">
            <p class="text-white mb-6">
              {{ t('forgotPasswordView.instructions') }}
            </p>

            <form @submit="onSubmit" class="space-y-6">
              <div class="flex flex-col gap-2">
                <label for="email" class="font-medium">{{
                  t('forgotPasswordView.emailLabel')
                }}</label>
                <InputText
                  id="email"
                  v-model="email"
                  type="email"
                  :placeholder="t('forgotPasswordView.emailPlaceholder')"
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
                  :label="t('forgotPasswordView.submitButton')"
                  class="w-full"
                  :disabled="loading"
                />

                <div class="text-center text-sm">
                  <Button
                    link
                    :label="t('forgotPasswordView.backToLoginLink')"
                    @click="router.push('/login')"
                    class="text-gray-600"
                  />
                </div>
              </div>
            </form>
          </div>

          <div v-else class="text-center py-4">
            <i class="fa fa-check-circle text-green-500 text-5xl mb-4"></i>
            <h3 class="text-xl font-semibold mb-2">{{ t('forgotPasswordView.successTitle') }}</h3>
            <p class="text-white mb-6">
              {{ t('forgotPasswordView.successMessage') }}
            </p>
            <p class="text-sm text-white mb-6">
              {{ t('forgotPasswordView.spamNote') }}
            </p>
            <Button
              :label="t('forgotPasswordView.backToLoginButton')"
              @click="router.push('/login')"
            />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import SkolLogo from '@/components/brand/SkolLogo.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { forgotPasswordSchema } from '@/schemas/auth.schema'

const { t } = useI18n()
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
