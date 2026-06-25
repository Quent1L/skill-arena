<template>
  <div>
    <div class="max-w-2xl mx-auto p-4">
      <h1 class="text-2xl font-bold mb-6">{{ t('settings.title') }}</h1>

      <div class="space-y-6">
        <!-- Apparence -->
        <Card v-if="false">
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-palette"></i>
              <span>{{ t('settings.appearance.title') }}</span>
            </div>
          </template>
          <template #content>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ t('settings.appearance.darkMode') }}</p>
                <p class="text-sm opacity-70">{{ t('settings.appearance.darkModeDesc') }}</p>
              </div>
              <ToggleSwitch :value="darkMode" @update:model-value="toggleDarkMode" />
            </div>
          </template>
        </Card>

        <!-- Langue -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-language"></i>
              <span>{{ t('settings.language.title') }}</span>
            </div>
          </template>
          <template #content>
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium">{{ t('settings.language.label') }}</p>
                <p class="text-sm opacity-70">{{ t('settings.language.desc') }}</p>
              </div>
              <Select
                v-model="currentLocale"
                input-id="language-select"
                :aria-label="t('settings.language.label')"
                :options="availableLocales"
                option-label="label"
                option-value="code"
                class="w-44"
              >
                <template #value="{ value }">
                  <span v-if="value" class="flex items-center gap-2">
                    <span>{{ availableLocales.find((l) => l.code === value)?.flag }}</span>
                    <span>{{ availableLocales.find((l) => l.code === value)?.label }}</span>
                  </span>
                </template>
                <template #option="{ option }">
                  <span class="flex items-center gap-2">
                    <span>{{ option.flag }}</span>
                    <span>{{ option.label }}</span>
                  </span>
                </template>
              </Select>
            </div>
          </template>
        </Card>

        <!-- Profil -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-user-edit"></i>
              <span>{{ t('settings.profile.title') }}</span>
            </div>
          </template>
          <template #content>
            <form @submit="onSubmitProfile" class="space-y-4">
              <Message v-if="profileSuccess" severity="success" :closable="false">
                <i class="fa fa-check mr-2"></i>
                {{ t('settings.profile.updateSuccess') }}
              </Message>

              <div class="flex flex-col gap-2">
                <label for="display-name" class="font-medium">{{ t('settings.profile.displayName') }}</label>
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
                <label for="short-name" class="font-medium">{{ t('settings.profile.shortName') }}</label>
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
                  {{ t('settings.profile.shortNameHint') }}
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
                  :label="t('common.cancel')"
                  severity="secondary"
                  outlined
                  type="button"
                  :disabled="profileLoading"
                  @click="$router.back()"
                />
                <Button
                  :label="t('common.save')"
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
              <span>{{ t('settings.application.title') }}</span>
            </div>
          </template>
          <template #content>
            <Message v-if="isInstalled" severity="success" :closable="false">
              {{ t('settings.application.installed') }}
            </Message>

            <div v-else-if="canInstall" class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium">{{ t('settings.application.install') }}</p>
                <p class="text-sm opacity-70">{{ t('settings.application.installDesc') }}</p>
              </div>
              <Button icon="fas fa-download" :label="t('settings.application.installBtn')" @click="triggerInstall" />
            </div>

            <Message
              v-if="isIOS && showIOSInstructions"
              severity="info"
              :closable="true"
              class="mt-3"
              @close="showIOSInstructions = false"
            >
              {{ t('settings.application.iosTap') }} <i class="fas fa-share-from-square mx-1"></i>
              {{ t('settings.application.iosThen') }}
              <strong>"{{ t('settings.application.iosAddToHome') }}"</strong>
            </Message>

            <Message v-else-if="!isInstalled && !canInstall" severity="secondary" :closable="false">
              {{ t('settings.application.notAvailable') }}
            </Message>
          </template>
        </Card>

        <!-- Notifications -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-bell"></i>
              <span>{{ t('settings.notifications.title') }}</span>
            </div>
          </template>
          <template #content>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ t('settings.notifications.push') }}</p>
                <p class="text-sm opacity-70">{{ t('settings.notifications.pushDesc') }}</p>
              </div>
              <ToggleSwitch
                :model-value="pushEnabled"
                @update:model-value="togglePushNotifications"
                :disabled="pushLoading"
              />
            </div>
            <Message v-if="!notificationSupported" severity="warn" class="mt-3">
              {{ t('settings.notifications.unsupported') }}
            </Message>
          </template>
        </Card>

        <!-- Compte -->
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="fas fa-user"></i>
              <span>{{ t('settings.account.title') }}</span>
            </div>
          </template>
          <template #content>
            <Button
              :label="t('settings.account.changePassword')"
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
              <span>{{ t('settings.groups.title') }}</span>
            </div>
          </template>
          <template #content>
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium">{{ t('settings.groups.join') }}</p>
                <p class="text-sm opacity-70">{{ t('settings.groups.joinDesc') }}</p>
              </div>
              <Button
                icon="fas fa-user-plus"
                :label="t('common.join')"
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
              <span>{{ t('settings.kiosk.title') }}</span>
            </div>
          </template>
          <template #content>
            <div class="space-y-3">
              <Message severity="warn" :closable="false">
                {{ t('settings.kiosk.warning') }}
              </Message>
              <Button
                :label="t('settings.kiosk.lock')"
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
      :header="t('settings.groups.join')"
      modal
      :style="{ width: '28rem' }"
      @hide="resetJoinOrgDialog"
    >
      <div class="space-y-4">
        <Message v-if="joinOrgSuccess" severity="success" :closable="false">
          <i class="fa fa-check mr-2"></i>
          {{ t('settings.groups.joinedPrefix') }} <strong>{{ joinOrgSuccessName }}</strong>.
        </Message>

        <template v-if="!joinOrgSuccess">
          <div class="flex flex-col gap-2">
            <label for="org-code" class="font-medium">{{ t('settings.groups.invitationCode') }}</label>
            <InputText
              id="org-code"
              v-model="joinOrgCode"
              :placeholder="t('settings.groups.codePlaceholder')"
              :disabled="joinOrgIsValidating || joinOrgLoading"
              class="w-full"
              @input="debouncedValidateOrgCode"
            />

            <div v-if="joinOrgIsValidating" class="flex items-center gap-2 text-blue-600">
              <i class="fa fa-spinner fa-spin"></i>
              <span class="text-sm">{{ t('settings.groups.validating') }}</span>
            </div>

            <Message v-else-if="joinOrgCodeError" severity="error" :closable="false">
              <i class="fa fa-times-circle mr-2"></i>
              {{ joinOrgCodeError }}
            </Message>

            <Message v-else-if="joinOrgCodeValid && joinOrgOrganizationName" severity="success" :closable="false">
              <i class="fa fa-check-circle mr-2"></i>
              {{ t('settings.groups.codeValidPrefix') }} <strong>{{ joinOrgOrganizationName }}</strong>
            </Message>
          </div>

          <Message v-if="joinOrgError" severity="error" :closable="false">
            <i class="fa fa-times-circle mr-2"></i>
            {{ joinOrgError }}
          </Message>

          <div class="flex justify-end gap-2 pt-2">
            <Button
              :label="t('common.cancel')"
              severity="secondary"
              outlined
              type="button"
              :disabled="joinOrgLoading"
              @click="showJoinOrgDialog = false"
            />
            <Button
              :label="t('common.join')"
              icon="fas fa-user-plus"
              :loading="joinOrgLoading"
              :disabled="!joinOrgCodeValid || !joinOrgOrganizationName || joinOrgLoading"
              @click="submitJoinOrg"
            />
          </div>
        </template>

        <div v-else class="flex justify-end pt-2">
          <Button :label="t('common.close')" type="button" @click="showJoinOrgDialog = false" />
        </div>
      </div>
    </Dialog>

    <!-- Dialog confirmation verrouillage kiosque -->
    <Dialog
      v-model:visible="showKioskLockDialog"
      :header="t('settings.kiosk.dialogTitle')"
      modal
      :style="{ width: '24rem' }"
    >
      <div class="space-y-4">
        <Message severity="warn" :closable="false">
          <strong>{{ t('settings.kiosk.attention') }}</strong> {{ t('settings.kiosk.dialogWarningBody') }}
        </Message>
        <p class="text-sm opacity-70">
          {{ t('settings.kiosk.dialogNote') }}
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            outlined
            @click="showKioskLockDialog = false"
          />
          <Button :label="t('settings.kiosk.lockShort')" icon="fas fa-lock" severity="danger" @click="activateKioskLock" />
        </div>
      </div>
    </Dialog>

    <!-- Dialog changement de mot de passe -->
    <Dialog
      v-model:visible="showChangePasswordDialog"
      :header="t('settings.password.title')"
      modal
      :style="{ width: '28rem' }"
      :closable="!authLoading"
    >
      <form @submit="onChangePassword" class="space-y-4">
        <Message v-if="changePasswordSuccess" severity="success" :closable="false">
          <i class="fa fa-check mr-2"></i>
          {{ t('settings.password.success') }}
        </Message>

        <template v-if="!changePasswordSuccess">
          <div class="flex flex-col gap-2">
            <label for="current-password" class="font-medium">{{ t('settings.password.current') }}</label>
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
            <label for="new-password" class="font-medium">{{ t('settings.password.new') }}</label>
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
            <label for="password-confirm" class="font-medium">{{
              t('settings.password.confirm')
            }}</label>
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
              :label="t('common.cancel')"
              severity="secondary"
              outlined
              type="button"
              :disabled="authLoading"
              @click="showChangePasswordDialog = false"
            />
            <Button
              :label="t('common.confirm')"
              type="submit"
              icon="fas fa-check"
              :loading="authLoading"
              :disabled="authLoading"
            />
          </div>
        </template>

        <div v-else class="flex justify-end pt-2">
          <Button :label="t('common.close')" type="button" @click="showChangePasswordDialog = false" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocale } from '@/composables/useLocale'
import { useRouter } from 'vue-router'
import { useNotificationPush } from '@/composables/notification/notification.push'
import { usePWAInstall } from '@/composables/pwa/pwa.install'
import { useAuth } from '@/composables/useAuth'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { changePasswordSchema } from '@/schemas/auth.schema'
import { displayNameRegex } from '@skill-arena/shared'
import { userApi } from '@/composables/user/user.api'
import { useInvitationService } from '@/composables/invitation/invitation.service'
import { useDebounceFn } from '@vueuse/core'

const { t } = useI18n()
const { currentLocale, availableLocales } = useLocale()

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

// Profile form — schema is reactive so validation messages follow the locale
const profileValidationSchema = computed(() =>
  toTypedSchema(
    z.object({
      displayName: z
        .string()
        .trim()
        .min(3, t('settings.validation.min3'))
        .max(50, t('settings.validation.displayNameMax'))
        .regex(displayNameRegex, t('settings.validation.nameRegex')),
      shortName: z
        .string()
        .trim()
        .min(3, t('settings.validation.min3'))
        .max(8, t('settings.validation.shortNameMax'))
        .regex(displayNameRegex, t('settings.validation.nameRegex'))
        .transform((v) => v.toUpperCase()),
    }),
  ),
)

const profileLoading = ref(false)
const profileSuccess = ref(false)
const profileError = ref<string | null>(null)

const {
  defineField: defineProfileField,
  handleSubmit: handleProfileSubmit,
  errors: profileErrors,
  setValues: setProfileValues,
} = useForm({
  validationSchema: profileValidationSchema,
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
    profileError.value = t('settings.profile.updateError')
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
      joinOrgCodeError.value = t('settings.groups.notGroupCode')
      return
    }
    joinOrgCodeValid.value = true
    joinOrgOrganizationName.value = result.organizationName ?? null
  } catch (err: unknown) {
    joinOrgCodeError.value = err instanceof Error ? err.message : t('settings.groups.invalidCode')
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
    joinOrgError.value = err instanceof Error ? err.message : t('settings.groups.joinError')
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
    profileError.value = t('settings.profile.loadError')
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
