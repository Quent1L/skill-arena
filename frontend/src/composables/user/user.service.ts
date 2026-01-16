import { ref } from 'vue'
import { userApi, type UserResponse } from './user.api'

export function useUserService() {
  const users = ref<UserResponse[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Get all users (admin only)
   */
  async function listUsers(): Promise<UserResponse[]> {
    try {
      loading.value = true
      error.value = null

      const result = await userApi.list()
      users.value = result

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des utilisateurs'
      error.value = message

      console.error('Erreur lors du chargement des utilisateurs:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    users,
    loading,
    error,

    // Actions
    listUsers,
  }
}
