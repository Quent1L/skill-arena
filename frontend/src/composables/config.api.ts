import http from '@/config/ApiConfig'
import type { AppConfig } from '@skol-arena/shared/types/index'

export type { AppConfig }

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    const response = await http.get<AppConfig>('/api/config')
    return response.data
  },
}
