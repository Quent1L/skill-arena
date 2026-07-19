/* eslint-disable @typescript-eslint/no-explicit-any */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, keycloak } from "better-auth/plugins";
import { db } from "./database";
import * as schema from "../db/schema";
import { emailService } from "../services/email.service";
import { invitationService } from "../services/invitation.service";
import i18next from "./i18n";
import { logger } from "../utils/logger";
import { clearBootstrapPending } from "../utils/init-admin";

function extractInvitationCode(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const invitationCookie = cookies.find((c) => c.startsWith("invitation_code="));
  return invitationCookie ? invitationCookie.split("=")[1] : null;
}

const isEmailPasswordEnabled = process.env.ENABLE_EMAIL_PASSWORD !== "false";
const isKeycloakEnabled = !!(
  process.env.KEYCLOAK_CLIENT_ID &&
  process.env.KEYCLOAK_CLIENT_SECRET &&
  process.env.KEYCLOAK_ISSUER
);

if (!isEmailPasswordEnabled && !isKeycloakEnabled) {
  logger.fatal({
    emailPassword: isEmailPasswordEnabled,
    keycloak: isKeycloakEnabled,
  }, "ERREUR DE CONFIGURATION CRITIQUE: Aucune méthode d'authentification n'est activée");

  throw new Error(
    "AUTHENTICATION_CONFIG_ERROR: At least one authentication method must be enabled. " +
    "Set ENABLE_EMAIL_PASSWORD=true or configure Keycloak (KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET, KEYCLOAK_ISSUER)"
  );
}

logger.info({
  emailPassword: isEmailPasswordEnabled,
  keycloak: isKeycloakEnabled,
}, "Configuration de l'authentification");

const plugins: any[] = [];

// Shared function to process invitation codes during sign-up
async function processInvitationCode(
  user: any,
  request: any,
  source: string
): Promise<void> {
  if (!user) {
    logger.error(`[${source}] No user in context`);
    return;
  }

  logger.info(`[${source}] Processing user: ${user.id}`);

  const cookieHeader = request?.headers?.get("cookie");
  const invitationCode = extractInvitationCode(cookieHeader);

  if (!invitationCode) {
    logger.warn(
      `[${source}] No invitation code for user ${user.id} - appUser creation will be blocked`
    );
    return;
  }

  try {
    const ipAddress =
      request?.headers?.get("x-forwarded-for") ||
      request?.headers?.get("x-real-ip") ||
      "unknown";

    await invitationService.consumeCode(
      invitationCode,
      user.id,
      user.email,
      ipAddress
    );

    logger.info(`[${source}] Code consumed successfully for user ${user.id}`);
  } catch (error: any) {
    logger.error(`[${source}] Code consumption failed:`, error);
    // Note: We do NOT delete the user here
    // appUser creation will be blocked in userService.getOrCreateAppUser()
  }
}

// Plugin to stop the startup password rotation once the bootstrap admin connects
plugins.push({
  id: "bootstrap-admin-activator",
  hooks: {
    after: [
      {
        matcher: (context: any) =>
          context.path === "/sign-in/email" ||
          context.path === "/change-password" ||
          context.path?.includes("/oauth2/callback/keycloak") ||
          context.path?.includes("/sign-in-oauth2"),
        handler: async (context: any) => {
          try {
            const signedIn =
              context.context?.newSession?.user ??
              context.context?.session?.user ??
              context.context?.returned?.user;
            if (signedIn?.id) {
              await clearBootstrapPending(signedIn.id);
            }
          } catch (error: any) {
            // Never let this break the login flow
            logger.error({ err: error }, "[Bootstrap Admin Hook] Failed to clear pending flag");
          }
          return {};
        },
      },
    ],
  },
});

// Plugin to consume invitation codes during sign-up
plugins.push({
  id: "invitation-code-consumer",
  hooks: {
    after: [
      {
        // Hook for email/password sign-up
        matcher: (context: any) => context.path === "/sign-up/email",
        handler: async (context: any) => {
          const user =
            context.context?.newSession?.user ?? context.context?.returned?.user;
          await processInvitationCode(user, context.request, "Email Registration Hook");
          return {};
        },
      },
      {
        // Hook for OAuth sign-up (Keycloak)
        matcher: (context: any) => {
          return (
            context.path?.includes("/oauth2/callback/keycloak") ||
            context.path?.includes("/sign-in-oauth2")
          );
        },
        handler: async (context: any) => {
          // Check whether this is a new user
          const user =
            context.context?.newSession?.user ?? context.context?.returned?.user;
          if (!user || !context.isNewUser) {
            return {};
          }

          await processInvitationCode(user, context.request, "Keycloak Hook");
          return {};
        },
      },
    ],
  },
});

if (isKeycloakEnabled) {
  plugins.push(
    genericOAuth({
      config: [
        keycloak({
          clientId: process.env.KEYCLOAK_CLIENT_ID!,
          clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
          issuer: process.env.KEYCLOAK_ISSUER!,
          pkce: process.env.KEYCLOAK_PKCE === "true",
          // Note: disableImplicitSignUp is NOT set (defaults to false)
          // This allows account creation which will then be validated by the invitation-code-validator hook
          // The hook will delete the user if no valid invitation code is present
        }),
      ],
    })
  );
}

// Without BETTER_AUTH_URL the localhost fallback emits cookies with no `Secure` flag and
// narrows trustedOrigins to localhost: random logouts that are very hard to diagnose.
if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_URL) {
  console.warn(
    "[auth] BETTER_AUTH_URL non défini en production : fallback sur http://localhost:3000. " +
      "Les cookies de session seront émis sans l'attribut Secure et trustedOrigins ne contiendra que localhost.",
  );
}

// Dynamic Better Auth configuration
const authConfig: any = {
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh if the session is more than 1 day old
    // Avoids a Postgres lookup on every request (addUserContext runs on "*").
    // Accepted trade-off: revoking a session takes up to 5 min to apply.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["keycloak"],
    },
  },
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  baseURL: process.env.BETTER_AUTH_URL || process.env.BASE_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  plugins,
};

// Email/password is always enabled in Better Auth to allow admin login.
// ENABLE_EMAIL_PASSWORD=false only hides the form on the frontend side.
authConfig.emailAndPassword = {
  enabled: true,
  sendResetPassword: async ({ user, url }: any) => {
    void emailService.sendEmail({
      to: user.email,
      subject: i18next.t("emails.password_reset_subject"),
      text: i18next.t("emails.password_reset_text", {
        url,
        expiresIn: 60,
      }),
      html: i18next.t("emails.password_reset_html", {
        url,
        expiresIn: 60,
      }),
    });
  },
  resetPasswordTokenExpiresIn: 3600,
  minPasswordLength: 8,
  maxPasswordLength: 128,
};

export const auth = betterAuth(authConfig);
