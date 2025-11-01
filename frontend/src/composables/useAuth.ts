/**
 * Composable pour l'authentification avec Better Auth
 */

import { ref, computed } from 'vue'
import { authClient } from '@/lib/auth-client'

export function useAuth() {
  const sessionData = authClient.useSession()
  const loading = ref(false)
  const error = ref<string | null>(null)

  const currentUser = computed(() => sessionData.value.data?.user || null)
  const isAuthenticated = computed(() => !!sessionData.value.data?.user)
  //const isAdmin = computed(() => sessionData.value.data?.user?.isAdmin || false)

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
   * Déconnexion
   */
  async function logout() {
    loading.value = true
    error.value = null

    try {
      await authClient.signOut()
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
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    authClient,
  }
}
