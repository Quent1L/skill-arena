import http from '@/config/ApiConfig.ts'

// The shapes are declared in shared/, where they also feed the backend's OpenAPI
// document, and re-exported here so existing import sites keep working.
export type {
  AppConfig,
  AuthConfig,
  EmailPasswordConfig,
  KeycloakConfig,
  RankedConfig,
} from '@skol-arena/shared/types/index'

import type { AppConfig } from '@skol-arena/shared/types/index'

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    const { data } = await http.get('/api/config')
    return data
  },
}
