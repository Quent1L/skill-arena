import http from '@/config/ApiConfig'

export interface RawNotification {
  id: string
  title: string
  message: string
  actionUrl: string | null
  requiresAction: boolean
  isRead: boolean
  actionCompleted?: boolean
  createdAt: Date // Converted by convertStringDatesToJS interceptor
}

const BASE_URL = '/api'

export const notificationApi = {
  async list(): Promise<RawNotification[]> {
    const res = await http.get<RawNotification[]>(`${BASE_URL}/me/notifications`)
    return res.data
  },
  async markRead(id: string): Promise<void> {
    await http.post(`${BASE_URL}/me/notifications/${id}/read`)
  },
  async markActionCompleted(id: string): Promise<void> {
    await http.post(`${BASE_URL}/me/notifications/${id}/action-completed`)
  },
  async resend(id: string, messageKey?: string): Promise<void> {
    await http.post(`${BASE_URL}/notifications/${id}/resend`, messageKey ? { messageKey } : undefined)
  },
  async registerPushDevice(payload: { subscriptionEndpoint: string; subscriptionData: unknown; deviceType: 'WEB' | 'ANDROID' | 'IOS' }): Promise<void> {
    await http.post(`${BASE_URL}/me/pushDevices`, payload)
  },
  async removePushDevice(deviceId: string): Promise<void> {
    await http.delete(`${BASE_URL}/me/pushDevices/${deviceId}`)
  },
  async getPushDevices(): Promise<Array<{ id: string; deviceType: string; subscriptionEndpoint: string }>> {
    const res = await http.get(`${BASE_URL}/me/pushDevices`)
    return res.data
  },
  async delete(id: string): Promise<void> {
    await http.delete(`${BASE_URL}/me/notifications/${id}`)
  }
}
