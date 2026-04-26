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

        <!-- Profil -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-user-edit"></i>
              <span>Profil</span>
            </div>
          </template>
          <template #content>
            <form @submit="onSubmitProfile" class="space-y-4">
              <Message v-if="profileSuccess" severity="success" :closable="false">
                <i class="fa fa-check mr-2"></i>
                Profil mis à jour avec succès.
              </Message>

              <div class="flex flex-col gap-2">
                <label for="display-name" class="font-medium">Nom</label>
                <InputText
                  id="display-name"
                  v-model="displayName"
                  :invalid="!!profileErrors.displayName"
                  :disabled="profileLoading"
                  class="w-full"
                  maxlength="50"
                />
                <small v-if="profileErrors.displayName" class="text-red-500">
                  {{ profileErrors.displayName }}
                </small>
              </div>

              <div class="flex flex-col gap-2">
                <label for="short-name" class="font-medium">Nom court (affichage mobile)</label>
                <InputText
                  id="short-name"
                  v-model="shortName"
                  :invalid="!!profileErrors.shortName"
                  :disabled="profileLoading"
                  class="w-full"
                  maxlength="8"
                  @input="shortName = (shortName ?? '').toUpperCase()"
                />
                <small class="opacity-60">
                  Jusqu'à 8 caractères, affiché dans le classement à la place du nom complet.
                </small>
                <small v-if="profileErrors.shortName" class="text-red-500">
                  {{ profileErrors.shortName }}
                </small>
              </div>

              <Message v-if="profileError" severity="error" :closable="false">
                {{ profileError }}
              </Message>

              <div class="flex justify-end gap-2 pt-2">
                <Button
                  label="Annuler"
                  severity="secondary"
                  outlined
                  type="button"
                  :disabled="profileLoading"
                  @click="$router.back()"
                />
                <Button
                  label="Enregistrer"
                  type="submit"
                  icon="fas fa-save"
                  :loading="profileLoading"
                  :disabled="profileLoading"
                />
              </div>
            </form>
          </template>
        </Card>

        <!-- Application -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-mobile-alt"></i>
              <span>Application</span>
            </div>
          </template>
          <template #content>
            <Message v-if="isInstalled" severity="success" :closable="false">
              L'application est déjà installée sur cet appareil.
            </Message>

            <div v-else-if="canInstall" class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium">Installer l'application</p>
                <p class="text-sm opacity-70">Accès rapide depuis l'écran d'accueil</p>
              </div>
              <Button icon="fas fa-download" label="Installer" @click="triggerInstall" />
            </div>

            <Message
              v-if="isIOS && showIOSInstructions"
              severity="info"
              :closable="true"
              class="mt-3"
              @close="showIOSInstructions = false"
            >
              Appuyez sur <i class="fas fa-share-from-square mx-1"></i> puis
              <strong>"Sur l'écran d'accueil"</strong>
            </Message>

            <Message v-else-if="!isInstalled && !canInstall" severity="secondary" :closable="false">
              L'installation n'est pas disponible sur ce navigateur.
            </Message>
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
            <Button
              label="Changer le mot de passe"
              outlined
              icon="fas fa-key"
              severity="secondary"
              class="w-full"
              @click="openChangePasswordDialog"
            />
          </template>
        </Card>

        <!-- Groupes -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-users"></i>
              <span>Groupes</span>
            </div>
          </template>
          <template #content>
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium">Rejoindre un groupe</p>
                <p class="text-sm opacity-70">Accéder aux tournois privés d'un groupe</p>
              </div>
              <Button
                icon="fas fa-user-plus"
                label="Rejoindre"
                outlined
                severity="secondary"
                @click="openJoinOrgDialog"
              />
            </div>
          </template>
        </Card>

        <!-- Mode kiosque -->
        <Card v-if="userRole === 'kiosk'">
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-lock"></i>
              <span>Mode kiosque</span>
            </div>
          </template>
          <template #content>
            <div class="space-y-3">
              <Message severity="warn" :closable="false">
                En verrouillant les paramètres, vous ne pourrez plus y accéder tant que
                l'utilisateur ne se sera pas reconnecté sur cet appareil.
              </Message>
              <Button
                label="Verrouiller les paramètres"
                icon="fas fa-lock"
                severity="danger"
                outlined
                class="w-full"
                @click="showKioskLockDialog = true"
              />
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Dialog rejoindre un groupe -->
    <Dialog
      v-model:visible="showJoinOrgDialog"
      header="Rejoindre un groupe"
      modal
      :style="{ width: '28rem' }"
      @hide="resetJoinOrgDialog"
    >
      <div class="space-y-4">
        <Message v-if="joinOrgSuccess" severity="success" :closable="false">
          <i class="fa fa-check mr-2"></i>
          Vous avez rejoint <strong>{{ joinOrgSuccessName }}</strong>.
        </Message>

        <template v-if="!joinOrgSuccess">
          <div class="flex flex-col gap-2">
            <label for="org-code" class="font-medium">Code d'invitation</label>
            <InputText
              id="org-code"
              v-model="joinOrgCode"
              placeholder="ex: tigre-riviere-soleil-lune"
              :disabled="joinOrgIsValidating || joinOrgLoading"
              class="w-full"
              @input="debouncedValidateOrgCode"
            />

            <div v-if="joinOrgIsValidating" class="flex items-center gap-2 text-blue-600">
              <i class="fa fa-spinner fa-spin"></i>
              <span class="text-sm">Validation en cours...</span>
            </div>

            <Message v-else-if="joinOrgCodeError" severity="error" :closable="false">
              <i class="fa fa-times-circle mr-2"></i>
              {{ joinOrgCodeError }}
            </Message>

            <Message v-else-if="joinOrgCodeValid && joinOrgOrganizationName" severity="success" :closable="false">
              <i class="fa fa-check-circle mr-2"></i>
              Code valide — groupe : <strong>{{ joinOrgOrganizationName }}</strong>
            </Message>
          </div>

          <Message v-if="joinOrgError" severity="error" :closable="false">
            <i class="fa fa-times-circle mr-2"></i>
            {{ joinOrgError }}
          </Message>

          <div class="flex justify-end gap-2 pt-2">
            <Button
              label="Annuler"
              severity="secondary"
              outlined
              type="button"
              :disabled="joinOrgLoading"
              @click="showJoinOrgDialog = false"
            />
            <Button
              label="Rejoindre"
              icon="fas fa-user-plus"
              :loading="joinOrgLoading"
              :disabled="!joinOrgCodeValid || !joinOrgOrganizationName || joinOrgLoading"
              @click="submitJoinOrg"
            />
          </div>
        </template>

        <div v-else class="flex justify-end pt-2">
          <Button label="Fermer" type="button" @click="showJoinOrgDialog = false" />
        </div>
      </div>
    </Dialog>

    <!-- Dialog confirmation verrouillage kiosque -->
    <Dialog
      v-model:visible="showKioskLockDialog"
      header="Verrouiller les paramètres ?"
      modal
      :style="{ width: '24rem' }"
    >
      <div class="space-y-4">
        <Message severity="warn" :closable="false">
          <strong>Attention :</strong> Cette action verrouillera l'accès aux paramètres. Pour y
          accéder à nouveau, vous devrez vous déconnecter et vous reconnecter.
        </Message>
        <p class="text-sm opacity-70">
          Cette fonctionnalité est conçue pour les appareils partagés en accès public.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <Button
            label="Annuler"
            severity="secondary"
            outlined
            @click="showKioskLockDialog = false"
          />
          <Button label="Verrouiller" icon="fas fa-lock" severity="danger" @click="activateKioskLock" />
        </div>
      </div>
    </Dialog>

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
import { useRouter } from 'vue-router'
import { useNotificationPush } from '@/composables/notification/notification.push'
import { usePWAInstall } from '@/composables/pwa/pwa.install'
import { useAuth } from '@/composables/useAuth'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { changePasswordSchema } from '@/schemas/auth.schema'
import { userApi } from '@/composables/user/user.api'
import { useInvitationService } from '@/composables/invitation/invitation.service'
import { useDebounceFn } from '@vueuse/core'

const { isInstalled, isIOS, canInstall, showIOSInstructions, triggerInstall } = usePWAInstall()

const darkMode = ref(false)
const pushEnabled = ref(false)
const pushLoading = ref(false)

const notificationSupported = computed(
  () => typeof window !== 'undefined' && 'Notification' in window,
)

const router = useRouter()
const { enablePush, disablePush } = useNotificationPush()
const { changePassword, loading: authLoading, error: authError, userRole, lockKioskSettings } = useAuth()

// Kiosk lock
const showKioskLockDialog = ref(false)

function activateKioskLock() {
  lockKioskSettings()
  showKioskLockDialog.value = false
  router.push('/')
}

// Profile form
const profileSchema = z.object({
  displayName: z.string().min(1, 'Le nom est requis').max(50),
  shortName: z
    .string()
    .min(1, 'Le nom court est requis')
    .max(8, 'Maximum 8 caractères')
    .transform((v) => v.toUpperCase()),
})

const profileLoading = ref(false)
const profileSuccess = ref(false)
const profileError = ref<string | null>(null)

const {
  defineField: defineProfileField,
  handleSubmit: handleProfileSubmit,
  errors: profileErrors,
  setValues: setProfileValues,
} = useForm({
  validationSchema: toTypedSchema(profileSchema),
})

const [displayName] = defineProfileField('displayName')
const [shortName] = defineProfileField('shortName')

const onSubmitProfile = handleProfileSubmit(async (values) => {
  profileLoading.value = true
  profileSuccess.value = false
  profileError.value = null
  try {
    await userApi.updateProfile(values)
    profileSuccess.value = true
  } catch {
    profileError.value = 'Une erreur est survenue lors de la mise à jour.'
  } finally {
    profileLoading.value = false
  }
})

// Change password form
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

// Join organization dialog
const { joinOrganization, validateCode: validateInvitationCode } = useInvitationService()

const showJoinOrgDialog = ref(false)
const joinOrgCode = ref('')
const joinOrgIsValidating = ref(false)
const joinOrgCodeValid = ref(false)
const joinOrgCodeError = ref<string | null>(null)
const joinOrgOrganizationName = ref<string | null>(null)
const joinOrgLoading = ref(false)
const joinOrgSuccess = ref(false)
const joinOrgSuccessName = ref('')
const joinOrgError = ref<string | null>(null)

function openJoinOrgDialog() {
  resetJoinOrgDialog()
  showJoinOrgDialog.value = true
}

function resetJoinOrgDialog() {
  joinOrgCode.value = ''
  joinOrgIsValidating.value = false
  joinOrgCodeValid.value = false
  joinOrgCodeError.value = null
  joinOrgOrganizationName.value = null
  joinOrgSuccess.value = false
  joinOrgSuccessName.value = ''
  joinOrgError.value = null
}

const debouncedValidateOrgCode = useDebounceFn(async () => {
  if (!/^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/.test(joinOrgCode.value)) {
    joinOrgCodeValid.value = false
    joinOrgCodeError.value = null
    joinOrgOrganizationName.value = null
    return
  }
  joinOrgIsValidating.value = true
  joinOrgCodeError.value = null
  joinOrgCodeValid.value = false
  joinOrgOrganizationName.value = null
  try {
    const result = await validateInvitationCode(joinOrgCode.value)
    if (!result.organizationId) {
      joinOrgCodeError.value = "Ce code n'est pas un code de groupe."
      return
    }
    joinOrgCodeValid.value = true
    joinOrgOrganizationName.value = result.organizationName ?? null
  } catch (err: unknown) {
    joinOrgCodeError.value = err instanceof Error ? err.message : 'Code invalide'
  } finally {
    joinOrgIsValidating.value = false
  }
}, 500)

async function submitJoinOrg() {
  if (!joinOrgCodeValid.value || joinOrgLoading.value) return
  joinOrgLoading.value = true
  joinOrgError.value = null
  try {
    const result = await joinOrganization(joinOrgCode.value)
    joinOrgSuccessName.value = result.organizationName
    joinOrgSuccess.value = true
  } catch (err: unknown) {
    joinOrgError.value = err instanceof Error ? err.message : "Erreur lors de l'adhésion au groupe."
  } finally {
    joinOrgLoading.value = false
  }
}

onMounted(async () => {
  const theme = localStorage.getItem('theme')
  darkMode.value = theme === 'dark'

  if ('Notification' in window) {
    pushEnabled.value = Notification.permission === 'granted'
  }

  try {
    const user = await userApi.me()
    setProfileValues({ displayName: user.displayName, shortName: user.shortName })
  } catch {
    profileError.value = 'Impossible de charger le profil.'
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
