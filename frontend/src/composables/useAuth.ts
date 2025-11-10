/**
 * Composable pour l'authentification avec Better Auth
 */

import { ref, computed } from 'vue'
import { authClient } from '@/lib/auth-client'
import { userApi, type UserResponse } from '@/composables/user/user.api'

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

  async function checkSession() {
    if (loading.value) {
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

      // Mettre à jour la session après connexion
      await checkSession()

      // Récupérer les données utilisateur
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
        error.value = result.error.message || "Erreur lors de l'inscription"
        throw new Error(result.error.message)
      }

      // Mettre à jour la session après inscription
      await checkSession()

      // Récupérer les données utilisateur
      await fetchUserData()

      return result
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Une erreur est survenue lors de l'inscription"
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
        } catch (userDataError) {
          console.warn('Impossible de récupérer les données utilisateur:', userDataError)
          // Continue même si on ne peut pas récupérer les données utilisateur
        }
      }
    } catch {
      // Ignore les erreurs d'initialisation
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
      await authClient.signOut()
      sessionData.value = { data: { user: null, session: null } }
      appUserData.value = null
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Une erreur est survenue lors de la déconnexion'
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
  }
}
