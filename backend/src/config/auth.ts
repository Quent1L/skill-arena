import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, keycloak } from "better-auth/plugins";
import { db } from "./database";
import * as schema from "../db/schema";
import { emailService } from "../services/email.service";
import { invitationService } from "../services/invitation.service";
import i18next from "./i18n";

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
  console.error("\n" + "=".repeat(80));
  console.error("❌ ERREUR DE CONFIGURATION CRITIQUE");
  console.error("=".repeat(80));
  console.error("Aucune méthode d'authentification n'est activée !");
  console.error("");
  console.error("Au moins une des configurations suivantes est requise :");
  console.error("  1. Email/Password : ENABLE_EMAIL_PASSWORD=true");
  console.error("  2. Keycloak SSO   : KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET, KEYCLOAK_ISSUER");
  console.error("");
  console.error("État actuel :");
  console.error(`  - Email/Password : ${isEmailPasswordEnabled ? "✓ Activé" : "✗ Désactivé"}`);
  console.error(`  - Keycloak SSO   : ${isKeycloakEnabled ? "✓ Activé" : "✗ Désactivé (variables manquantes)"}`);
  console.error("=".repeat(80) + "\n");

  throw new Error(
    "AUTHENTICATION_CONFIG_ERROR: At least one authentication method must be enabled. " +
    "Set ENABLE_EMAIL_PASSWORD=true or configure Keycloak (KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET, KEYCLOAK_ISSUER)"
  );
}

// Logs de configuration
console.log("\n" + "=".repeat(80));
console.log("🔐 Configuration de l'authentification");
console.log("=".repeat(80));
console.log(`Email/Password : ${isEmailPasswordEnabled ? "✅ Activé" : "⚠️  Désactivé"}`);
console.log(`Keycloak SSO   : ${isKeycloakEnabled ? "✅ Activé" : "⚠️  Désactivé"}`);
console.log("=".repeat(80) + "\n");

const plugins: any[] = [];

// Fonction commune pour traiter les codes d'invitation lors de l'inscription
async function processInvitationCode(
  user: any,
  request: any,
  source: string
): Promise<void> {
  if (!user) {
    console.error(`[${source}] No user in context`);
    return;
  }

  console.log(`[${source}] Processing user: ${user.id}`);

  const cookieHeader = request?.headers?.get("cookie");
  const invitationCode = extractInvitationCode(cookieHeader);

  if (!invitationCode) {
    console.warn(
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

    console.log(`[${source}] Code consumed successfully for user ${user.id}`);
  } catch (error: any) {
    console.error(`[${source}] Code consumption failed:`, error);
    // Note: On ne supprime PAS l'utilisateur ici
    // La création du appUser sera bloquée dans userService.getOrCreateAppUser()
  }
}

// Plugin pour consommer les codes d'invitation lors de l'inscription
plugins.push({
  id: "invitation-code-consumer",
  hooks: {
    after: [
      {
        // Hook pour l'inscription email/password
        matcher: (context: any) => context.path === "/sign-up/email",
        handler: async (context: any) => {
          const user =
            context.context?.newSession?.user ?? context.context?.returned?.user;
          await processInvitationCode(user, context.request, "Email Registration Hook");
          return {};
        },
      },
      {
        // Hook pour l'inscription OAuth (Keycloak)
        matcher: (context: any) => {
          return (
            context.path?.includes("/oauth2/callback/keycloak") ||
            context.path?.includes("/sign-in-oauth2")
          );
        },
        handler: async (context: any) => {
          // Vérifier si c'est un nouvel utilisateur
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
          // Note: disableImplicitSignUp is NOT set (defaults to false)
          // This allows account creation which will then be validated by the invitation-code-validator hook
          // The hook will delete the user if no valid invitation code is present
        }),
      ],
    })
  );
}

// Configuration dynamique de Better Auth
const authConfig: any = {
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["keycloak"],
    },
  },
  trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
  baseURL: process.env.BETTER_AUTH_URL || process.env.BASE_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  plugins,
};

// Email/password est toujours activé dans Better Auth pour permettre la connexion admin.
// ENABLE_EMAIL_PASSWORD=false masque uniquement le formulaire côté frontend.
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
