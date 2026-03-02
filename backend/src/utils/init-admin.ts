import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../config/database";
import { user, account, appUsers } from "../db/schema";
import { hashPassword } from "better-auth/crypto";


export async function initializeAdminIfNeeded(): Promise<void> {
  const existingUsers = await db.select().from(appUsers).limit(1);
  if (existingUsers.length > 0) {
    console.log("ℹ️  Utilisateurs existants, création de l'admin initiale ignorée.");
    return;
  }

  const adminEmail =
    process.env.INITIAL_ADMIN_EMAIL ?? "admin@skill-arena.local";
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

  console.log("\n" + "=".repeat(80));
  console.log("🚀 PREMIER DÉMARRAGE — COMPTE ADMINISTRATEUR CRÉÉ AUTOMATIQUEMENT");
  console.log("=".repeat(80));
  console.log(`  Email    : ${adminEmail}`);
  console.log(`  Mot de passe : ${password}`);
  console.log("");
  console.log("  ⚠️  Changez ce mot de passe après votre première connexion !");
  console.log(
    "  👉 Connectez-vous via : /login?native=true"
  );
  console.log("=".repeat(80) + "\n");
}
