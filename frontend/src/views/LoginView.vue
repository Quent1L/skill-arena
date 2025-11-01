<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8 text-white">
        <h1 class="text-4xl font-bold">Skill Arena</h1>
        <p class="mt-2">Connectez-vous à votre compte</p>
      </div>

      <Card>
        <template #content>
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

            <div class="flex flex-col gap-2">
              <label for="password" class="font-medium">Mot de passe</label>
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

            <Message v-if="error" severity="error" :closable="false">
              {{ error }}
            </Message>

            <div class="space-y-3">
              <Button
                type="submit"
                :loading="loading"
                label="Se connecter"
                class="w-full"
                :disabled="loading"
              />

              <div class="text-center text-sm">
                <span class="text-gray-600">Pas encore de compte ?</span>
                <Button
                  link
                  label="S'inscrire"
                  @click="router.push('/register')"
                  class="ml-1 p-0"
                />
              </div>

              <div class="text-center">
                <Button
                  link
                  label="← Retour à l'accueil"
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
import { useAuth } from '@/composables/useAuth'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { loginSchema } from '@/schemas/auth.schema'

const router = useRouter()
const route = useRoute()
const { login, loading, error } = useAuth()

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(loginSchema),
})

const [email] = defineField('email')
const [password] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  try {
    await login({
      email: values.email,
      password: values.password,
    })

    const redirectPath = route.query.redirect as string
    router.push(redirectPath || '/tournaments')
  } catch (err) {
    console.error('Erreur de connexion:', err)
  }
})
</script>
