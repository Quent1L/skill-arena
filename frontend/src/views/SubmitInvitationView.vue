<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8 text-white">
        <h1 class="text-4xl font-bold">Skol</h1>
        <p class="mt-2">Activation du compte</p>
        <p class="mt-1 text-sm text-gray-300">Soumettez votre code d'invitation</p>
      </div>

      <Card>
        <template #content>
          <div class="space-y-6">
            <Message severity="info" :closable="false">
              <div class="space-y-2">
                <p class="font-semibold">
                  <i class="fa fa-info-circle mr-2"></i>
                  Code d'invitation requis
                </p>
                <p class="text-sm">
                  Votre compte a été créé avec succès, mais vous devez soumettre un code
                  d'invitation pour accéder à l'application.
                </p>
              </div>
            </Message>

            <div class="flex flex-col gap-2">
              <label for="code" class="font-medium">Code d'invitation</label>
              <InputText
                id="code"
                v-model="invitationCode"
                placeholder="Entrez votre code d'invitation (32 caractères)"
                :disabled="isValidating || codeValid || isSubmitting"
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

            <Message v-if="submitError" severity="error" :closable="false">
              <i class="fa fa-times-circle mr-2"></i>
              {{ submitError }}
            </Message>

            <div class="flex gap-2">
              <Button
                @click="submitCode"
                :disabled="!codeValid || isSubmitting"
                :loading="isSubmitting"
                class="flex-1"
                size="large"
              >
                <i class="fa fa-check mr-2"></i>
                {{ isSubmitting ? 'Soumission...' : 'Soumettre le code' }}
              </Button>

              <Button
                @click="logout"
                :disabled="isSubmitting"
                severity="secondary"
                outlined
                size="large"
              >
                <i class="fa fa-sign-out mr-2"></i>
                Se déconnecter
              </Button>
            </div>

            <Message v-if="!codeError && !codeValid" severity="info" :closable="false">
              Veuillez entrer votre code d'invitation pour continuer.
            </Message>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useInvitationService } from '@/composables/invitation/invitation.service'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { validateCode, consumeCode } = useInvitationService()
const { logout: authLogout, fetchUserData } = useAuth()

const invitationCode = ref('')
const isValidating = ref(false)
const codeValid = ref(false)
const codeError = ref<string | null>(null)
const remainingUses = ref(0)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

const debouncedValidate = useDebounceFn(async () => {
  if (invitationCode.value.length !== 32) {
    codeValid.value = false
    codeError.value = null
    return
  }

  isValidating.value = true
  codeError.value = null
  codeValid.value = false

  try {
    const result = await validateCode(invitationCode.value)
    if (result.valid) {
      codeValid.value = true
      remainingUses.value = result.remainingUses
    }
  } catch (err: any) {
    codeError.value = err.message || 'Code invalide'
  } finally {
    isValidating.value = false
  }
}, 500)

async function submitCode() {
  if (!codeValid.value || isSubmitting.value) return

  isSubmitting.value = true
  submitError.value = null

  try {
    await consumeCode(invitationCode.value)

    // Rafraîchir les données utilisateur pour obtenir l'appUser
    await fetchUserData()

    // Rediriger vers la page d'accueil
    router.push('/')
  } catch (err: any) {
    submitError.value = err.message || 'Erreur lors de la soumission du code'
  } finally {
    isSubmitting.value = false
  }
}

async function logout() {
  try {
    await authLogout()
    router.push('/login')
  } catch (err) {
    console.error('Erreur lors de la déconnexion:', err)
  }
}
</script>
