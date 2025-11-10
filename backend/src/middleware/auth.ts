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

  const appUserId = await userService.getOrCreateAppUser(
    betterAuthUser.id,
    betterAuthUser.name || betterAuthUser.email
  );

  c.set("appUserId", appUserId);
  await next();
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
