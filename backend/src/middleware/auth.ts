import type { Context, Next } from "hono";
import { auth } from "../config/auth";
import { userService } from "../services/user.service";
import type { AppVariablesOptional } from "../types/hono";
import { logger } from "../utils/logger";

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
  } catch (error: unknown) {
    // If the error is related to a missing invitation code
    if ((error as { code?: string }).code === "INVITATION_CODE_REQUIRED") {
      logger.warn(`[Auth Middleware] User ${betterAuthUser.id} is authenticated but has no invitation code`);

      // Return a 403 Forbidden error with a clear message
      // The user is authenticated (valid session) but must submit an invitation code
      return c.json(
        {
          error: {
            code: "INVITATION_CODE_REQUIRED",
            message: "Vous devez soumettre un code d'invitation pour activer votre compte."
          }
        },
        403 // Forbidden (authenticated but not authorized)
      );
    }

    // Other errors
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
