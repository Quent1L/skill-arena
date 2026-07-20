import http from '@/config/ApiConfig'
import type {
  AdminArchiveUserInput,
  AdminRestoreUserInput,
  AdminUpdateUserInput,
  AdminUserDetail,
  AdminUserListQuery,
  AdminUserListResponse,
  AdminUserStats,
} from '@skol-arena/shared/types/index'

// Raw API calls to backend - no business logic here
const BASE_URL = '/api/admin/users'

export const adminUsersApi = {
  async list(params: Partial<AdminUserListQuery>): Promise<AdminUserListResponse> {
    const { data } = await http.get<AdminUserListResponse>(BASE_URL, { params })
    return data
  },

  async stats(): Promise<AdminUserStats> {
    const { data } = await http.get<AdminUserStats>(`${BASE_URL}/stats`)
    return data
  },

  async getById(id: string): Promise<AdminUserDetail> {
    const { data } = await http.get<AdminUserDetail>(`${BASE_URL}/${id}`)
    return data
  },

  async update(id: string, payload: AdminUpdateUserInput): Promise<AdminUserDetail> {
    const { data } = await http.patch<AdminUserDetail>(`${BASE_URL}/${id}`, payload)
    return data
  },

  async resetPassword(id: string): Promise<void> {
    await http.post(`${BASE_URL}/${id}/reset-password`)
  },

  async deactivate(id: string): Promise<AdminUserDetail> {
    const { data } = await http.post<AdminUserDetail>(`${BASE_URL}/${id}/deactivate`)
    return data
  },

  async reactivate(id: string): Promise<AdminUserDetail> {
    const { data } = await http.post<AdminUserDetail>(`${BASE_URL}/${id}/reactivate`)
    return data
  },

  async archive(id: string, input: AdminArchiveUserInput): Promise<AdminUserDetail> {
    const { data } = await http.post<AdminUserDetail>(`${BASE_URL}/${id}/archive`, input)
    return data
  },

  async restore(id: string, input: AdminRestoreUserInput): Promise<AdminUserDetail> {
    const { data } = await http.post<AdminUserDetail>(`${BASE_URL}/${id}/restore`, input)
    return data
  },

  async delete(id: string): Promise<void> {
    await http.delete(`${BASE_URL}/${id}`)
  },

  async addOrganization(id: string, organizationId: string): Promise<void> {
    await http.post(`${BASE_URL}/${id}/organizations`, { organizationId })
  },

  async removeOrganization(id: string, organizationId: string): Promise<void> {
    await http.delete(`${BASE_URL}/${id}/organizations/${organizationId}`)
  },
}
