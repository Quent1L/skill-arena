<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8 text-white">
        <h1 class="text-4xl font-bold">Skill Arena</h1>
        <p class="mt-2">Connectez-vous à votre compte</p>
      </div>

      <Card>
        <template #content>
          <!-- Message d'erreur si aucune méthode d'authentification n'est disponible -->
          <Message v-if="noAuthMethodAvailable" severity="error" :closable="false" class="mb-6">
            <div class="space-y-2">
              <p class="font-semibold">
                <i class="fa fa-exclamation-triangle mr-2"></i>
                Aucune méthode d'authentification n'est disponible
              </p>
              <p class="text-sm">
                Contactez l'administrateur système. La configuration de l'authentification est incorrecte.
              </p>
            </div>
          </Message>

          <form v-if="!noAuthMethodAvailable" @submit="onSubmit" class="space-y-6">
            <!-- Formulaire Email/Password (seulement si activé) -->
            <template v-if="emailPasswordEnabled">
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
                <div class="text-right">
                  <Button
                    link
                    label="Mot de passe oublié ?"
                    @click="router.push('/forgot-password')"
                    class="text-sm text-blue-600 hover:text-blue-700 p-0"
                    type="button"
                  />
                </div>
              </div>

              <Message v-if="error" severity="error" :closable="false">
                {{ error }}
              </Message>

              <Button
                type="submit"
                :loading="loading"
                label="Se connecter"
                class="w-full"
                :disabled="loading"
              />

              <!-- Séparateur "Ou" uniquement si les deux méthodes sont activées -->
              <div v-if="keycloakEnabled" class="relative">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-gray-300"></div>
                </div>
                <div class="relative flex justify-center text-sm">
                  <span class="px-2 bg-white text-gray-500">Ou</span>
                </div>
              </div>
            </template>

            <!-- Bouton Keycloak (affiché si activé) -->
            <Button
              v-if="keycloakEnabled"
              @click="loginWithKeycloak"
              :loading="isKeycloakLoading"
              :disabled="isKeycloakLoading || loading"
              class="w-full"
              outlined
              severity="secondary"
              type="button"
            >
              <i class="fa fa-building mr-2"></i>
              {{ isKeycloakLoading ? 'Connexion...' : 'Se connecter avec Keycloak' }}
            </Button>

            <!-- Lien d'inscription -->
            <div class="text-center text-sm">
              <span class="text-gray-600">Pas encore de compte ?</span>
              <Button
                link
                label="S'inscrire"
                @click="router.push('/signup')"
                class="ml-1 p-0"
                type="button"
              />
            </div>

            <!-- Retour à l'accueil -->
            <div class="text-center">
              <Button
                link
                label="← Retour à l'accueil"
                @click="router.push('/public')"
                class="text-sm text-gray-600"
                type="button"
              />
            </div>
          </form>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useConfigService } from '@/composables/config/config.service'
import { authClient } from '@/lib/auth-client'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { loginSchema } from '@/schemas/auth.schema'

const router = useRouter()
const route = useRoute()
const { login, loading, error } = useAuth()
const { config } = useConfigService()

const isKeycloakLoading = ref(false)
const emailPasswordEnabled = computed(() => config.value?.auth?.emailPassword?.enabled ?? true)
const keycloakEnabled = computed(() => config.value?.auth?.keycloak?.enabled ?? false)
const noAuthMethodAvailable = computed(() => !emailPasswordEnabled.value && !keycloakEnabled.value)

// Détecter les erreurs OAuth dans l'URL (redirection depuis Better Auth)
if (route.query.error) {
  const errorDescription = route.query.error_description as string
  error.value = errorDescription || 'Une erreur est survenue lors de la connexion'

  // Nettoyer l'URL
  router.replace({ query: {} })
}

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
    console.log('Connexion réussie')

    const redirectPath = route.query.redirect as string
    router.push(redirectPath ?? '/')
  } catch (err) {
    console.error('Erreur de connexion:', err)
  }
})

async function loginWithKeycloak() {
  isKeycloakLoading.value = true

  try {
    const callbackURL = import.meta.env.DEV
      ? 'http://localhost:5173/'
      : '/'

    await authClient.signIn.oauth2({
      providerId: 'keycloak',
      callbackURL,
    })
  } catch (err: any) {
    isKeycloakLoading.value = false
    error.value = err.message || 'Erreur lors de la connexion Keycloak'
    console.error('Keycloak sign-in error:', err)
  }
}
</script>
