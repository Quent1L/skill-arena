import type { Context, Next } from "hono";
import { auth } from "../config/auth";
import { userService } from "../services/user.service";
import type { AppVariablesOptional } from "../types/hono";

type AppContext = Context<{
  Variables: AppVariablesOptional;
}>;

export async function requireAuth(c: AppContext, next: () => Promise<void>) {
  const betterAuthUser = c.get("user");

  if (!betterAuthUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const appUserId = await userService.getOrCreateAppUser(
      betterAuthUser.id,
      betterAuthUser.name || betterAuthUser.email
    );

    c.set("appUserId", appUserId);
    await next();
  } catch (error: any) {
    // Si l'erreur est liée au code d'invitation manquant
    if (error.code === "INVITATION_CODE_REQUIRED") {
      console.warn(`[Auth Middleware] User ${betterAuthUser.id} is authenticated but has no invitation code`);

      // Retourner une erreur 403 Forbidden avec un message clair
      // L'utilisateur est authentifié (session valide) mais doit soumettre un code d'invitation
      return c.json(
        {
          error: {
            code: "INVITATION_CODE_REQUIRED",
            message: "Vous devez soumettre un code d'invitation pour activer votre compte."
          }
        },
        403 // Forbidden (authentifié mais pas autorisé)
      );
    }

    // Autres erreurs
    throw error;
  }
}

export async function addUserContext(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
}
