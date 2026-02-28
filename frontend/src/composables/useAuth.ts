/**
 * Composable pour l'authentification avec Better Auth
 */

import { ref, computed } from 'vue'
import { authClient } from '@/lib/auth-client'
import { userApi, type UserResponse } from '@/composables/user/user.api'
import { useConfigService } from '@/composables/config/config.service'

const sessionData = ref()
const appUserData = ref<UserResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

/**
 * Récupère les données de l'utilisateur depuis l'API /users/me
 */
async function fetchUserData() {
  try {
    console.log('Récupération des données utilisateur...')
    const userData = await userApi.me()
    appUserData.value = userData
    console.log('Données utilisateur récupérées:', userData)
  } catch (err) {
    console.error('Erreur lors de la récupération des données utilisateur:', err)
    appUserData.value = null
    throw err
  }
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

  async function checkSession(force = false) {
    if (loading.value && !force) {
      return sessionData.value
    }

    loading.value = true
    error.value = null

    try {
      const result = await authClient.getSession()
      console.log('Session check result:', result) // Debug
      if (result.error) {
        error.value = result.error.message || 'Erreur lors de la récupération de la session'
        sessionData.value = { data: { user: null, session: null } }
        appUserData.value = null
        throw new Error(result.error.message)
      }
      sessionData.value = result
      console.log('Updated session data:', sessionData.value) // Debug
      return result
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de la récupération de la session'
      error.value = message
      sessionData.value = { data: { user: null, session: null } }
      appUserData.value = null
      throw err
    } finally {
      loading.value = false
    }
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
        error.value = result.error.message || 'Erreur de connexion'
        throw new Error(result.error.message)
      }

      await checkSession(true)

      await fetchUserData()

      return result
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Une erreur est survenue lors de la connexion'
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
        const errorMessage =
          result.error?.message ?? "Erreur lors de l'inscription"

        error.value = errorMessage
        throw new Error(errorMessage)
      }

      await initialize()

      return result
    } catch (err: any) {
      // Gérer les erreurs spécifiques du code d'invitation
      let message = "Une erreur est survenue lors de l'inscription"

      if (err instanceof Error) {
        message = err.message
      } else if (err?.error?.message) {
        message = err.error.message
      } else if (err?.message) {
        message = err.message
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

    try {
      console.log('Initialisation de la session utilisateur...')
      await checkSession()

      // Si l'utilisateur est connecté, récupérer ses données
      if (sessionData.value?.data?.user) {
        try {
          await fetchUserData()
        } catch (fetchError: any) {
          // Si l'erreur est INVITATION_CODE_REQUIRED, la propager pour que le guard la gère
          if (fetchError?.cause === 'INVITATION_CODE_REQUIRED') {
            throw fetchError
          }
          // Pour les autres erreurs (401, etc.), réinitialiser silencieusement
          console.warn('Erreur lors de la récupération des données utilisateur:', fetchError)
          sessionData.value = { data: { user: null, session: null } }
          appUserData.value = null
        }
      }
    } catch (err: any) {
      // Si c'est INVITATION_CODE_REQUIRED, propager l'erreur
      if (err?.cause === 'INVITATION_CODE_REQUIRED') {
        throw err
      }
      // Ignore les autres erreurs d'initialisation
      sessionData.value = { data: { user: null, session: null } }
      appUserData.value = null
    }
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
          config.value.auth.keycloak.clientId || undefined
        )
        window.location.href = keycloakLogoutUrl
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Une erreur est survenue lors de la déconnexion'
      error.value = message
      throw err
    } finally {
      loading.value = false
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

  /**
   * Demande de réinitialisation de mot de passe
   */
  async function requestPasswordReset(email: string) {
    loading.value = true
    error.value = null

    try {
      const result = await authClient.forgetPassword({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (result.error) {
        error.value = result.error.message || 'Erreur lors de la demande de réinitialisation'
        throw new Error(result.error.message)
      }

      return result
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de la demande de réinitialisation'
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
        error.value = result.error.message || 'Erreur lors de la réinitialisation du mot de passe'
        throw new Error(result.error.message)
      }

      return result
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de la réinitialisation du mot de passe'
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
        error.value = result.error.message || 'Erreur lors du changement de mot de passe'
        throw new Error(result.error.message)
      }

      return result
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors du changement de mot de passe'
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
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
  }
}
