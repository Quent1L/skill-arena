import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../config/database";
import { user, account, appUsers } from "../db/schema";
import { hashPassword } from "better-auth/crypto";
import { logger } from "./logger";


export async function initializeAdminIfNeeded(): Promise<void> {
  const existingUsers = await db.select().from(appUsers).limit(1);
  if (existingUsers.length > 0) {
    logger.info("Utilisateurs existants, creation de l'admin initiale ignoree.");
    return;
  }

  const adminEmail =
    process.env.INITIAL_ADMIN_EMAIL ?? "admin@skol-arena.local";
  const password = randomBytes(12).toString("base64url");
  const userId = randomUUID();

  await db.insert(user).values({
    id: userId,
    name: "Admin",
    email: adminEmail,
    emailVerified: true,
  });

  const hashedPassword = await hashPassword(password);

  await db.insert(account).values({
    id: randomUUID(),
    providerId: "credential",
    accountId: adminEmail,
    userId,
    password: hashedPassword,
  });

  await db.insert(appUsers).values({
    externalId: userId,
    displayName: "Admin",
    shortName: "ADMIN",
    role: "super_admin",
  });

  logger.info({
    email: adminEmail,
    password,
  }, "PREMIER DEMARRAGE — COMPTE ADMINISTRATEUR CREE AUTOMATIQUEMENT. Changez ce mot de passe apres votre premiere connexion via /login?native=true");
}
