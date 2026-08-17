import { z } from "zod";

// ============================================
// Runtime configuration served to the client
// ============================================

export const keycloakConfigSchema = z
  .object({
    enabled: z.boolean(),
    clientId: z.string().nullable(),
    issuer: z.string().nullable(),
    realm: z.string().nullable(),
    loginLabel: z.string().nullable(),
  })
  .meta({ id: "KeycloakConfig" });

export type KeycloakConfig = z.infer<typeof keycloakConfigSchema>;

export const emailPasswordConfigSchema = z
  .object({ enabled: z.boolean() })
  .meta({ id: "EmailPasswordConfig" });

export type EmailPasswordConfig = z.infer<typeof emailPasswordConfigSchema>;

export const authConfigSchema = z
  .object({
    emailPassword: emailPasswordConfigSchema,
    keycloak: keycloakConfigSchema,
  })
  .meta({ id: "AuthConfig" });

export type AuthConfig = z.infer<typeof authConfigSchema>;

/**
 * What GET /config returns: the handful of server settings the SPA needs before a
 * user is known — which sign-in methods are available, and the push public key.
 */
export const appConfigSchema = z
  .object({
    vapidPublicKey: z.string().nullable(),
    auth: authConfigSchema,
  })
  .meta({ id: "AppConfig" });

export type AppConfig = z.infer<typeof appConfigSchema>;
