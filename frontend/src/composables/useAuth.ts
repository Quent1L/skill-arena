/**
 * Composable pour l'authentification avec Better Auth
 */

import { ref, computed } from 'vue'
import { authClient } from '@/lib/auth-client'
import type { LoginCredentials, RegisterCredentials } from '@skill-arena/shared'

export function useAuth() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Hook Better Auth pour obtenir la session
  const sessionData = authClient.useSession()

  const currentUser = computed(() => sessionData.value.data?.user || null)
  const isAuthenticated = computed(() => !!sessionData.value.data?.user)
  const isAdmin = computed(() => sessionData.value.data?.user?.isAdmin || false)

  /**
   * Connexion d'un utilisateur
   */
  const login = async (credentials: LoginCredentials) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: authError } = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
      })

      if (authError) {
        throw new Error(authError.message || 'Erreur de connexion')
      }

      return data?.user
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de connexion'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  const register = async (credentials: RegisterCredentials) => {
    loading.value = true
    error.value = null

    try {
      // Utiliser le nom fourni, sinon le username, sinon la partie avant @ de l'email
      const displayName =
        credentials.name ?? credentials.username ?? credentials.email.split('@')[0]

      const { data, error: authError } = await authClient.signUp.email({
        email: credentials.email,
        password: credentials.password,
        name: displayName ?? '',
      })

      if (authError) {
        throw new Error(authError.message || "Erreur lors de l'inscription")
      }

      return data?.user
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'inscription"
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Déconnexion
   */
  const logout = async () => {
    try {
      await authClient.signOut()
    } catch (err: unknown) {
      console.error('Erreur lors de la déconnexion:', err)
    }
  }

  /**
   * Rafraîchir les informations de l'utilisateur
   */
  const refreshUser = async () => {
    // Better Auth gère automatiquement le rafraîchissement de session
    // La session est mise à jour automatiquement via les hooks
  }

  return {
    currentUser,
    isAuthenticated,
    isAdmin,
    loading: computed(() => loading.value || sessionData.value.isPending),
    error: computed(() => error.value),
    login,
    register,
    logout,
    refreshUser,
  }
}
