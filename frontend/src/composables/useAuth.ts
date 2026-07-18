/**
 * Composable pour l'authentification avec Better Auth
 */

import { ref, computed } from 'vue'
import { authClient } from '@/lib/auth-client'
import { userApi, type UserResponse } from '@/composables/user/user.api'
import { useConfigService } from '@/composables/config/config.service'
import { NETWORK_ERROR, isNetworkError, isTransientStatus } from '@/utils/HttpErrors'
import { i18n } from '@/i18n'

const sessionData = ref()
const appUserData = ref<UserResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const kioskSettingsLocked = ref(localStorage.getItem('kiosk_settings_locked') === 'true')

const RETRY_DELAY_MS = 600

function networkError(): Error {
  return new Error(i18n.global.t('auth.errors.sessionFetchGeneric'), { cause: NETWORK_ERROR })
}

/** Shared in-flight promises: keeps two concurrent guards from racing each other. */
let inFlightCheck: Promise<unknown> | null = null
let inFlightInit: Promise<void> | null = null

/**
 * Récupère les données de l'utilisateur depuis l'API /users/me
 */
async function fetchUserData() {
  try {
    const userData = await userApi.me()
    appUserData.value = userData
  } catch (err) {
    console.error('Erreur lors de la récupération des données utilisateur:', err)
    appUserData.value = null
    throw err
  }
}

/**
 * Construit l'URL de logout Keycloak
 */
function buildKeycloakLogoutUrl(issuer: string, clientId?: string): string {
  const postLogoutRedirectUri = window.location.origin + '/login'
  const logoutUrl = `${issuer}/protocol/openid-connect/logout`

  const params = new URLSearchParams({
    post_logout_redirect_uri: postLogoutRedirectUri,
  })

  if (clientId) {
    params.append('client_id', clientId)
  }

  return `${logoutUrl}?${params.toString()}`
}

export function useAuth() {
  const currentUser = computed(() => sessionData.value?.data?.user || null)
  const appUser = computed(() => appUserData.value)
  const isAuthenticated = computed(() => !!sessionData.value?.data?.user && !!appUserData.value)
  const isSuperAdmin = computed(() => appUserData.value?.role === 'super_admin' || false)
  const isAdmin = computed(
    () =>
      appUserData.value?.role === 'super_admin' ||
      appUserData.value?.role === 'tournament_admin' ||
      false,
  )
  const userRole = computed(() => appUserData.value?.role || 'player')
  const token = computed(() => sessionData.value?.data?.session?.token || null)
  const isInitialized = computed(() => sessionData.value !== undefined)

  /**
   * A single round-trip to Better Auth.
   * Throws an error marked NETWORK_ERROR when the failure is transient, leaving the
   * session state untouched — the caller then decides whether to retry.
   */
  async function fetchSessionOnce() {
    let result
    try {
      result = await authClient.getSession()
    } catch {
      // better-fetch rejection: unreachable network, CORS, DNS, timeout.
      throw networkError()
    }

    if (result.error) {
      if (isTransientStatus(result.error.status)) {
        throw networkError()
      }
      // Explicit auth response (401, 403...): no session, a legitimate case.
      error.value = result.error.message || i18n.global.t('auth.errors.sessionFetch')
      sessionData.value = { data: { user: null, session: null } }
      appUserData.value = null
      throw new Error(result.error.message)
    }

    return result
  }

  async function checkSession(force = false) {
    if (inFlightCheck && !force) {
      return inFlightCheck
    }

    loading.value = true
    error.value = null

    const run = (async () => {
      try {
        // A single retry on network error: covers a restarting backend / cold start,
        // a frequent cause of false logouts.
        let result
        try {
          result = await fetchSessionOnce()
        } catch (err) {
          if (!isNetworkError(err)) throw err
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          result = await fetchSessionOnce()
        }

        sessionData.value = result
        return result
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : i18n.global.t('auth.errors.sessionFetchGeneric')
        // NB: the logged-out state is NOT written here. Either fetchSessionOnce already
        // did it for a real 401, or the failure is transient and the session stays
        // unknown (`undefined`) so a later navigation retries.
        throw err
      } finally {
        loading.value = false
        inFlightCheck = null
      }
    })()

    inFlightCheck = run
    return run
  }

  /**
   * Connexion avec email et mot de passe
   */
  async function login(credentials: { email: string; password: string }) {
    loading.value = true
    error.value = null

    try {
      const result = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
      })

      if (result.error) {
        error.value = result.error.message || i18n.global.t('auth.errors.login')
        throw new Error(result.error.message)
      }

      localStorage.removeItem('kiosk_settings_locked')
      kioskSettingsLocked.value = false
      await checkSession(true)

      await fetchUserData()

      return result
    } catch (err) {
      const message =
        err instanceof Error ? err.message : i18n.global.t('auth.errors.loginGeneric')
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Inscription avec email et mot de passe
   */
  async function register(credentials: {
    email: string
    name?: string
    password: string
    passwordConfirm: string
  }) {
    loading.value = true
    error.value = null

    try {
      const signUpData: {
        email: string
        password: string
        name: string
      } = {
        email: credentials.email,
        password: credentials.password,
        name: credentials.name ?? credentials.email.split('@')[0] ?? 'User',
      }

      const result = await authClient.signUp.email(signUpData)

      if (result.error) {
        // Better Auth peut retourner l'erreur dans différents formats
        const errorMessage = result.error?.message ?? i18n.global.t('auth.errors.register')

        error.value = errorMessage
        throw new Error(errorMessage)
      }

      await initialize()

      return result
    } catch (err: unknown) {
      // Gérer les erreurs spécifiques du code d'invitation
      let message = i18n.global.t('auth.errors.registerGeneric')

      if (err instanceof Error) {
        message = err.message
      } else if ((err as { error?: { message?: string } })?.error?.message) {
        message = (err as { error: { message: string } }).error.message
      } else if ((err as { message?: string })?.message) {
        message = (err as { message: string }).message
      }

      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Initialise la session au démarrage de l'application
   */
  async function initialize() {
    if (sessionData.value !== undefined) {
      return // Déjà initialisé
    }
    if (inFlightInit) {
      return inFlightInit // Two concurrent guards await the same promise
    }

    const run = (async () => {
      try {
        console.log('Initialisation de la session utilisateur...')
        await checkSession()

        // Si l'utilisateur est connecté, récupérer ses données
        if (sessionData.value?.data?.user) {
          try {
            await fetchUserData()
          } catch (fetchError: unknown) {
            // Si l'erreur est INVITATION_CODE_REQUIRED, la propager pour que le guard la gère
            if ((fetchError as { cause?: string })?.cause === 'INVITATION_CODE_REQUIRED') {
              throw fetchError
            }
            // Transient error on /users/me: the Better Auth session is still valid.
            // Reset the state to "unknown" to retry, rather than logging out.
            if (isNetworkError(fetchError)) {
              sessionData.value = undefined
              appUserData.value = null
              throw fetchError
            }
            // Real auth error (401): legitimate logout.
            console.warn('Erreur lors de la récupération des données utilisateur:', fetchError)
            sessionData.value = { data: { user: null, session: null } }
            appUserData.value = null
          }
        }
      } catch (err: unknown) {
        if ((err as { cause?: string })?.cause === 'INVITATION_CODE_REQUIRED') {
          throw err
        }
        // Transient failure: pin nothing. `sessionData` stays `undefined` so
        // `isInitialized` stays false and the next navigation really retries.
        if (isNetworkError(err)) {
          throw err
        }
        // Authentication error: legitimate logged-out state.
        sessionData.value = { data: { user: null, session: null } }
        appUserData.value = null
      } finally {
        inFlightInit = null
      }
    })()

    inFlightInit = run
    return run
  }

  /**
   * Déconnexion
   */
  async function logout() {
    loading.value = true
    error.value = null

    try {
      // Déconnecter de Better Auth
      await authClient.signOut()
      sessionData.value = undefined
      appUserData.value = null

      // Si Keycloak est activé, rediriger vers le logout Keycloak
      const { config } = useConfigService()
      if (config.value?.auth?.keycloak?.enabled && config.value?.auth?.keycloak?.issuer) {
        const keycloakLogoutUrl = buildKeycloakLogoutUrl(
          config.value.auth.keycloak.issuer,
          config.value.auth.keycloak.clientId || undefined,
        )
        window.location.href = keycloakLogoutUrl
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : i18n.global.t('auth.errors.logoutGeneric')
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }


  /**
   * Demande de réinitialisation de mot de passe
   */
  async function requestPasswordReset(email: string) {
    loading.value = true
    error.value = null

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (result.error) {
        error.value = result.error.message || i18n.global.t('auth.errors.passwordResetRequest')
        throw new Error(result.error.message)
      }

      return result
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : i18n.global.t('auth.errors.passwordResetRequestGeneric')
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Réinitialisation du mot de passe avec token
   */
  async function resetPassword(token: string, newPassword: string) {
    loading.value = true
    error.value = null

    try {
      const result = await authClient.resetPassword({
        newPassword,
        token,
      })

      if (result.error) {
        error.value = result.error.message || i18n.global.t('auth.errors.passwordReset')
        throw new Error(result.error.message)
      }

      return result
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : i18n.global.t('auth.errors.passwordResetGeneric')
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Changement de mot de passe (utilisateur connecté)
   */
  async function changePassword(currentPassword: string, newPassword: string) {
    loading.value = true
    error.value = null

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      })

      if (result.error) {
        error.value = result.error.message || i18n.global.t('auth.errors.passwordChange')
        throw new Error(result.error.message)
      }

      return result
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : i18n.global.t('auth.errors.passwordChangeGeneric')
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  function lockKioskSettings() {
    localStorage.setItem('kiosk_settings_locked', 'true')
    kioskSettingsLocked.value = true
  }

  return {
    currentUser,
    appUser,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    userRole,
    loading,
    error,
    isInitialized,
    login,
    register,
    logout,
    checkSession,
    fetchUserData,
    initialize,
    authClient,
    token,
    requestPasswordReset,
    resetPassword,
    changePassword,
    kioskSettingsLocked,
    lockKioskSettings,
  }
}
