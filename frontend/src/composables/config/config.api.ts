import http from '@/config/ApiConfig.ts'

export interface KeycloakConfig {
  enabled: boolean;
  clientId: string | null;
  issuer: string | null;
  realm: string | null;
  loginLabel: string | null;
}

export interface EmailPasswordConfig {
  enabled: boolean;
}

export interface AuthConfig {
  emailPassword: EmailPasswordConfig;
  keycloak: KeycloakConfig;
}

export interface AppConfig {
  vapidPublicKey: string | null;
  auth: AuthConfig;
}

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    const { data } = await http.get("/api/config");
    return data;
  },
};
