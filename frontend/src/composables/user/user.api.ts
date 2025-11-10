import http from '@/config/ApiConfig'

const BASE_URL = '/api/users'

export interface UserResponse {
  id: string
  externalId: string
  displayName: string
  role: 'player' | 'tournament_admin' | 'super_admin'
  createdAt: string
  updatedAt: string
  betterAuth: {
    id: string
    email: string
    name: string | null
    image: string | null
    emailVerified: boolean
    createdAt: string
    updatedAt: string
  }
}

/**
 * Raw API calls for user endpoints
 */
export const userApi = {
  /**
   * Get current user details
   */
  async me(): Promise<UserResponse> {
    const response = await http.get<UserResponse>(`${BASE_URL}/me`)
    return response.data
  },
}
