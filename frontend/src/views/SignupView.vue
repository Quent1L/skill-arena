<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8 text-white">
        <h1 class="text-4xl font-bold">Skill Arena</h1>
        <p class="mt-2">Créer un compte</p>
        <p class="mt-1 text-sm text-gray-300">Code d'invitation requis</p>
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

          <div v-if="!noAuthMethodAvailable" class="space-y-6">
            <div class="flex flex-col gap-2">
              <label for="code" class="font-medium">Code d'invitation</label>
              <InputText
                id="code"
                v-model="invitationCode"
                placeholder="Entrez votre code d'invitation (32 caractères)"
                :disabled="isValidating || codeValid"
                class="w-full"
                @input="debouncedValidate"
              />

              <div v-if="isValidating" class="flex items-center gap-2 text-blue-600">
                <i class="fa fa-spinner fa-spin"></i>
                <span class="text-sm">Validation en cours...</span>
              </div>

              <Message v-else-if="codeError" severity="error" :closable="false">
                <i class="fa fa-times-circle mr-2"></i>
                {{ codeError }}
              </Message>

              <Message v-else-if="codeValid" severity="success" :closable="false">
                <i class="fa fa-check-circle mr-2"></i>
                Code valide ({{ remainingUses }} utilisation(s) restante(s))
              </Message>
            </div>

            <div v-if="codeValid" class="space-y-4">
              <div class="text-center">
                <p class="text-sm text-gray-600 font-medium">Choisissez votre méthode d'inscription :</p>
              </div>

              <Button
                v-if="emailPasswordEnabled"
                @click="proceedToEmailPasswordRegistration"
                class="w-full"
                size="large"
                outlined
              >
                <i class="fa fa-envelope mr-2"></i>
                Créer un compte Email / Mot de passe
              </Button>

              <Button
                v-if="keycloakEnabled"
                @click="proceedToKeycloakRegistration"
                :loading="isSigningIn"
                class="w-full"
                size="large"
                severity="secondary"
              >
                <i class="fa fa-building mr-2"></i>
                {{ isSigningIn ? 'Connexion...' : 'S\'inscrire avec Keycloak (SSO)' }}
              </Button>
            </div>

            <Message v-else-if="!codeError" severity="info" :closable="false">
              Veuillez entrer votre code d'invitation pour continuer.
            </Message>

            <div class="text-center">
              <Button
                link
                label="← Retour à la connexion"
                @click="router.push('/login')"
                class="text-sm text-gray-600"
                type="button"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { authClient } from '@/lib/auth-client'
import { useInvitationService } from '@/composables/invitation/invitation.service'
import { useConfigService } from '@/composables/config/config.service'
import { useToast } from 'primevue/usetoast'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { validateCode: validateCodeApi } = useInvitationService()
const { config } = useConfigService()

const invitationCode = ref('')
const codeValid = ref(false)
const codeError = ref('')
const isValidating = ref(false)
const remainingUses = ref(0)
const isSigningIn = ref(false)

const emailPasswordEnabled = computed(() => config.value?.auth?.emailPassword?.enabled ?? true)
const keycloakEnabled = computed(() => config.value?.auth?.keycloak?.enabled ?? false)
const noAuthMethodAvailable = computed(() => !emailPasswordEnabled.value && !keycloakEnabled.value)

onMounted(() => {
  // Vérifier si une erreur OAuth est présente dans l'URL
  const error = route.query.error as string
  const errorDescription = route.query.error_description as string

  if (error) {
    const errorMessage = errorDescription || 'Une erreur est survenue lors de l\'inscription'

    // Afficher l'erreur à l'utilisateur
    toast.add({
      severity: 'error',
      summary: 'Erreur d\'inscription',
      detail: errorMessage,
      life: 8000,
    })

    // Nettoyer l'URL
    router.replace({ query: {} })
  }

  const urlCode = route.query.code as string
  if (urlCode) {
    invitationCode.value = urlCode
    validateCode()
  }
})

async function validateCode() {
  if (!invitationCode.value.trim()) {
    codeValid.value = false
    codeError.value = ''
    return
  }

  if (invitationCode.value.length !== 32) {
    codeValid.value = false
    codeError.value = 'Le code doit contenir 32 caractères'
    return
  }

  isValidating.value = true
  codeError.value = ''

  try {
    const result = await validateCodeApi(invitationCode.value)

    if (result.valid) {
      codeValid.value = true
      remainingUses.value = result.remainingUses
    } else {
      codeValid.value = false
      codeError.value = 'Code invalide'
    }
  } catch (error: any) {
    codeValid.value = false
    codeError.value = error.message || 'Erreur lors de la validation'
  } finally {
    isValidating.value = false
  }
}

const debouncedValidate = useDebounceFn(validateCode, 500)

function proceedToEmailPasswordRegistration() {
  document.cookie = `invitation_code=${invitationCode.value}; path=/; max-age=600; SameSite=Lax`
  router.push('/register')
}

async function proceedToKeycloakRegistration() {
  isSigningIn.value = true

  try {
    document.cookie = `invitation_code=${invitationCode.value}; path=/; max-age=600; SameSite=Lax`

    // En dev, le frontend est sur localhost:5173, donc on doit spécifier l'URL complète
    // En prod (dockerisé), le frontend est servi par le backend, donc '/' suffit
    // Redirige vers la page d'accueil. Si pas de code d'invitation, le guard détectera
    // l'erreur INVITATION_CODE_REQUIRED et redirigera automatiquement vers /submit-invitation
    const callbackURL = import.meta.env.DEV
      ? 'http://localhost:5173/'
      : '/'

    // IMPORTANT: requestSignUp: true pour forcer la création de compte
    await authClient.signIn.oauth2({
      providerId: 'keycloak',
      callbackURL,
      requestSignUp: true,  // Force le sign-up (avec code d'invitation)
    })
  } catch (error: any) {
    isSigningIn.value = false
    codeError.value = error.message || 'Erreur lors de la connexion Keycloak'
    console.error('Keycloak sign-in error:', error)
  }
}
</script>
