<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8 text-white">
        <h1 class="text-4xl font-bold">Skol</h1>
        <p class="mt-2">{{ t('submitInvitationView.subtitle') }}</p>
        <p class="mt-1 text-sm text-gray-300">{{ t('submitInvitationView.hint') }}</p>
      </div>

      <Card>
        <template #content>
          <div class="space-y-6">
            <Message severity="info" :closable="false">
              <div class="space-y-2">
                <p class="font-semibold">
                  <i class="fa fa-info-circle mr-2"></i>
                  {{ t('submitInvitationView.infoTitle') }}
                </p>
                <p class="text-sm">
                  {{ t('submitInvitationView.infoDesc') }}
                </p>
              </div>
            </Message>

            <div class="flex flex-col gap-2">
              <label for="code" class="font-medium">{{ t('submitInvitationView.codeLabel') }}</label>
              <InputText
                id="code"
                v-model="invitationCode"
                :placeholder="t('submitInvitationView.codePlaceholder')"
                :disabled="isValidating || codeValid || isSubmitting"
                class="w-full"
                @input="debouncedValidate"
              />

              <div v-if="isValidating" class="flex items-center gap-2 text-blue-600">
                <i class="fa fa-spinner fa-spin"></i>
                <span class="text-sm">{{ t('submitInvitationView.validating') }}</span>
              </div>

              <Message v-else-if="codeError" severity="error" :closable="false">
                <i class="fa fa-times-circle mr-2"></i>
                {{ codeError }}
              </Message>

              <Message v-else-if="codeValid" severity="success" :closable="false">
                <i class="fa fa-check-circle mr-2"></i>
                {{ t('submitInvitationView.codeValid', { count: remainingUses }) }}
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
                {{ isSubmitting ? t('submitInvitationView.submitting') : t('submitInvitationView.submit') }}
              </Button>

              <Button
                @click="logout"
                :disabled="isSubmitting"
                severity="secondary"
                outlined
                size="large"
              >
                <i class="fa fa-sign-out mr-2"></i>
                {{ t('submitInvitationView.logout') }}
              </Button>
            </div>

            <Message v-if="!codeError && !codeValid" severity="info" :closable="false">
              {{ t('submitInvitationView.enterCodePrompt') }}
            </Message>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useInvitationService } from '@/composables/invitation/invitation.service'
import { useAuth } from '@/composables/useAuth'

const { t } = useI18n()
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

onMounted(async () => {
  const cookieCode = document.cookie
    .split('; ')
    .find(row => row.startsWith('invitation_code='))
    ?.split('=')[1]

  if (!cookieCode) return

  invitationCode.value = cookieCode
  isValidating.value = true
  codeError.value = null

  try {
    const result = await validateCode(cookieCode)
    if (result.valid) {
      codeValid.value = true
      remainingUses.value = result.remainingUses
      await submitCode()
    }
  } catch (err: unknown) {
    codeError.value = (err as Error).message || t('submitInvitationView.codeInvalid')
  } finally {
    isValidating.value = false
  }
})

const debouncedValidate = useDebounceFn(async () => {
  if (!/^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/.test(invitationCode.value)) {
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
  } catch (err: unknown) {
    codeError.value = (err as Error).message || t('submitInvitationView.codeInvalid')
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
    document.cookie = 'invitation_code=; path=/; max-age=0'

    // Refresh user data to obtain the appUser
    await fetchUserData()

    // Redirect to the home page
    router.push('/')
  } catch (err: unknown) {
    submitError.value = (err as Error).message || t('submitInvitationView.submitError')
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
