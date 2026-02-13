import { Hono } from "hono";

const configRoute = new Hono();

configRoute.get("/", (c) => {
  const isEmailPasswordEnabled = process.env.ENABLE_EMAIL_PASSWORD !== "false";
  const isKeycloakEnabled = !!(
    process.env.KEYCLOAK_CLIENT_ID &&
    process.env.KEYCLOAK_CLIENT_SECRET &&
    process.env.KEYCLOAK_ISSUER
  );

  const keycloakConfig = {
    enabled: isKeycloakEnabled,
    clientId: process.env.KEYCLOAK_CLIENT_ID || null,
    issuer: process.env.KEYCLOAK_ISSUER || null,
    realm: process.env.KEYCLOAK_ISSUER
      ? process.env.KEYCLOAK_ISSUER.split("/realms/")[1]?.split("/")[0]
      : null,
  };

  return c.json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    auth: {
      emailPassword: {
        enabled: isEmailPasswordEnabled,
      },
      keycloak: keycloakConfig,
    },
  });
});

export default configRoute;
