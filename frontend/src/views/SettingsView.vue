<template>
  <div>
    <div class="max-w-2xl mx-auto p-4">
      <h1 class="text-2xl font-bold mb-6">Paramètres</h1>

      <div class="space-y-6">
        <!-- Apparence -->
        <Card v-if="false">
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-palette"></i>
              <span>Apparence</span>
            </div>
          </template>
          <template #content>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">Mode sombre</p>
                <p class="text-sm opacity-70">Activer le thème sombre pour l'interface</p>
              </div>
              <ToggleSwitch :value="darkMode" @update:model-value="toggleDarkMode" />
            </div>
          </template>
        </Card>

        <!-- Notifications -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-bell"></i>
              <span>Notifications</span>
            </div>
          </template>
          <template #content>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">Notifications push</p>
                <p class="text-sm opacity-70">Recevoir des notifications sur cet appareil</p>
              </div>
              <ToggleSwitch
                :model-value="pushEnabled"
                @update:model-value="togglePushNotifications"
                :disabled="pushLoading"
              />
            </div>
            <Message v-if="!notificationSupported" severity="warn" class="mt-3">
              Les notifications push ne sont pas supportées par votre navigateur
            </Message>
          </template>
        </Card>

        <!-- Compte -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-user"></i>
              <span>Compte</span>
            </div>
          </template>
          <template #content>
            <div class="space-y-3">
              <Button
                label="Modifier le profil"
                outlined
                icon="fas fa-edit"
                @click="$router.push('/profile')"
                class="w-full"
              />
              <Button
                label="Changer le mot de passe"
                outlined
                icon="fas fa-key"
                severity="secondary"
                class="w-full"
                @click="openChangePasswordDialog"
              />
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Dialog changement de mot de passe -->
    <Dialog
      v-model:visible="showChangePasswordDialog"
      header="Changer le mot de passe"
      modal
      :style="{ width: '28rem' }"
      :closable="!authLoading"
    >
      <form @submit="onChangePassword" class="space-y-4">
        <Message v-if="changePasswordSuccess" severity="success" :closable="false">
          <i class="fa fa-check mr-2"></i>
          Mot de passe modifié avec succès.
        </Message>

        <template v-if="!changePasswordSuccess">
          <div class="flex flex-col gap-2">
            <label for="current-password" class="font-medium">Mot de passe actuel</label>
            <Password
              input-id="current-password"
              v-model="currentPassword"
              :feedback="false"
              toggle-mask
              :disabled="authLoading"
              :invalid="!!errors.currentPassword"
              class="w-full"
              input-class="w-full"
            />
            <small v-if="errors.currentPassword" class="text-red-500">
              {{ errors.currentPassword }}
            </small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="new-password" class="font-medium">Nouveau mot de passe</label>
            <Password
              input-id="new-password"
              v-model="newPassword"
              toggle-mask
              :disabled="authLoading"
              :invalid="!!errors.newPassword"
              class="w-full"
              input-class="w-full"
            />
            <small v-if="errors.newPassword" class="text-red-500">
              {{ errors.newPassword }}
            </small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="password-confirm" class="font-medium"
              >Confirmer le nouveau mot de passe</label
            >
            <Password
              input-id="password-confirm"
              v-model="passwordConfirm"
              :feedback="false"
              toggle-mask
              :disabled="authLoading"
              :invalid="!!errors.passwordConfirm"
              class="w-full"
              input-class="w-full"
            />
            <small v-if="errors.passwordConfirm" class="text-red-500">
              {{ errors.passwordConfirm }}
            </small>
          </div>

          <Message v-if="authError" severity="error" :closable="false">
            {{ authError }}
          </Message>

          <div class="flex justify-end gap-2 pt-2">
            <Button
              label="Annuler"
              severity="secondary"
              outlined
              type="button"
              :disabled="authLoading"
              @click="showChangePasswordDialog = false"
            />
            <Button
              label="Confirmer"
              type="submit"
              icon="fas fa-check"
              :loading="authLoading"
              :disabled="authLoading"
            />
          </div>
        </template>

        <div v-else class="flex justify-end pt-2">
          <Button label="Fermer" type="button" @click="showChangePasswordDialog = false" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useNotificationPush } from '@/composables/notification/notification.push'
import { useAuth } from '@/composables/useAuth'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { changePasswordSchema } from '@/schemas/auth.schema'

const darkMode = ref(false)
const pushEnabled = ref(false)
const pushLoading = ref(false)

const notificationSupported = computed(
  () => typeof window !== 'undefined' && 'Notification' in window,
)

const { enablePush, disablePush } = useNotificationPush()
const { changePassword, loading: authLoading, error: authError } = useAuth()

const showChangePasswordDialog = ref(false)
const changePasswordSuccess = ref(false)

const { defineField, handleSubmit, errors, resetForm } = useForm({
  validationSchema: toTypedSchema(changePasswordSchema),
})

const [currentPassword] = defineField('currentPassword')
const [newPassword] = defineField('newPassword')
const [passwordConfirm] = defineField('passwordConfirm')

function openChangePasswordDialog() {
  changePasswordSuccess.value = false
  authError.value = null
  resetForm()
  showChangePasswordDialog.value = true
}

const onChangePassword = handleSubmit(async (values) => {
  try {
    await changePassword(values.currentPassword, values.newPassword)
    changePasswordSuccess.value = true
    resetForm()
  } catch {
    // error displayed via authError
  }
})

onMounted(() => {
  const theme = localStorage.getItem('theme')
  darkMode.value = theme === 'dark'

  // Check if push is enabled
  if ('Notification' in window) {
    pushEnabled.value = Notification.permission === 'granted'
  }
})

function toggleDarkMode(newValue: boolean) {
  darkMode.value = newValue
  document.documentElement.classList.toggle('my-app-dark', darkMode.value)
  localStorage.setItem('theme', darkMode.value ? 'dark' : 'light')
}

async function togglePushNotifications(newValue: boolean) {
  console.log('[Settings] Toggle push notifications:', newValue, 'current:', pushEnabled.value)
  pushLoading.value = true
  try {
    if (newValue) {
      console.log('[Settings] Enabling push notifications...')
      const result = await enablePush()
      console.log('[Settings] Enable push result:', result)
      if (result) {
        pushEnabled.value = true
        console.log('[Settings] Push notifications enabled successfully')
      } else {
        console.warn('[Settings] Failed to enable push notifications, result was false')
        pushEnabled.value = false
      }
    } else {
      console.log('[Settings] Disabling push notifications...')
      const result = await disablePush()
      console.log('[Settings] Disable push result:', result)
      if (result) {
        pushEnabled.value = false
        console.log('[Settings] Push notifications disabled successfully')
      } else {
        console.warn('[Settings] Failed to disable push notifications, result was false')
        // Keep current state if disable failed
      }
    }
  } catch (error) {
    console.error('[Settings] Error toggling push notifications:', error)
    console.error('[Settings] Error details:', error instanceof Error ? error.message : error)
    console.error('[Settings] Error stack:', error instanceof Error ? error.stack : 'No stack')
    // Reset to actual state on error
    pushEnabled.value = Notification.permission === 'granted'
  } finally {
    pushLoading.value = false
    console.log('[Settings] Final push state:', pushEnabled.value)
  }
}
</script>
