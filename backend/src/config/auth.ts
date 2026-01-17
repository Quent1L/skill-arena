import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./database";
import * as schema from "../db/schema";
import { emailService } from "../services/email.service";
import i18next from "./i18n";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // Don't await to prevent timing attacks
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
    resetPasswordTokenExpiresIn: 3600, // 1 hour
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
  baseURL: process.env.BETTER_AUTH_URL || process.env.BASE_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
});
