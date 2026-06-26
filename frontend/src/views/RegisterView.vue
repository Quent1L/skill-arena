<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold">Skol</h1>
        <p class="mt-2">{{ t('registerView.subtitle') }}</p>
      </div>

      <Card>
        <template #content>
          <form @submit="onSubmit" class="space-y-6">
            <div class="flex flex-col gap-2">
              <label for="email" class="font-medium">{{ t('registerView.emailLabel') }}</label>
              <InputText
                id="email"
                v-model="email"
                type="email"
                :placeholder="t('registerView.emailPlaceholder')"
                :disabled="loading"
                :invalid="!!errors.email"
                class="w-full"
              />
              <small v-if="errors.email" class="text-red-500">
                {{ errors.email }}
              </small>
            </div>

            <div class="flex flex-col gap-2">
              <label for="name" class="font-medium">{{ t('registerView.nameLabel') }}</label>
              <InputText
                id="name"
                v-model="name"
                type="text"
                placeholder="John Doe"
                :disabled="loading"
                :invalid="!!errors.name"
                class="w-full"
              />
              <small v-if="errors.name" class="text-red-500">
                {{ errors.name }}
              </small>
            </div>

            <div class="flex flex-col gap-2">
              <label for="password" class="font-medium">{{ t('registerView.passwordLabel') }}</label>
              <Password
                id="password"
                v-model="password"
                :feedback="false"
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
              <label for="passwordConfirm" class="font-medium"> {{ t('registerView.passwordConfirmLabel') }} </label>
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

            <Message severity="info" :closable="false">
              {{ t('registerView.infoMessage') }}
            </Message>

            <div class="space-y-3">
              <Button
                type="submit"
                :loading="loading"
                :disabled="loading"
                :label="t('registerView.createAccount')"
                class="w-full"
              />

              <div class="text-center text-sm">
                <span class="text-gray-600">{{ t('registerView.alreadyHaveAccount') }}</span>
                <Button link :label="t('registerView.login')" @click="router.push('/login')" class="ml-1 p-0" />
              </div>

              <div class="text-center">
                <Button
                  link
                  :label="t('registerView.backToHome')"
                  @click="router.push('/')"
                  class="text-sm text-gray-600"
                />
              </div>
            </div>
          </form>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { registerSchema } from '@/schemas/auth.schema'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { register, loading, error } = useAuth()

// Note: La vérification du code d'invitation est gérée par le hook backend
// lors de l'inscription. Pas besoin de vérifier le cookie côté frontend.

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(registerSchema),
})

const [email] = defineField('email')
const [name] = defineField('name')
const [password] = defineField('password')
const [passwordConfirm] = defineField('passwordConfirm')

const onSubmit = handleSubmit(async (values) => {
  try {
    await register({
      email: values.email,
      name: values.name,
      password: values.password,
      passwordConfirm: values.passwordConfirm,
    })

    const redirectPath = route.query.redirect as string
    router.push(redirectPath || '/')
  } catch (err) {
    console.error("Erreur d'inscription:", err)
  }
})
</script>
