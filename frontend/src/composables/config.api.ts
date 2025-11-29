import http from '@/config/ApiConfig'

export interface AppConfig {
  vapidPublicKey: string | null
}

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    const response = await http.get<AppConfig>('/api/config')
    return response.data
  },
}
