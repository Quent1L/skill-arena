import { createAppHonoOptional, type AppHonoOptional } from "../types/hono";
import { VERSION_MOUNTS } from "./registry";
import type { ApiVersion } from "./versions";

/**
 * Builds the app serving a single API major.
 *
 * The result is mounted under INTERNAL_PREFIX at boot, and the same function feeds
 * OpenAPI generation — so the documented surface is the served surface by
 * construction, not by convention.
 */
export function buildVersionApp(version: ApiVersion): AppHonoOptional {
  const app = createAppHonoOptional();

  app.use("*", async (c, next) => {
    c.set("apiVersion", version);
    await next();
  });

  for (const { path, router } of VERSION_MOUNTS[version]) {
    // Hono infers a sub-app's Env from the argument, which a heterogeneous manifest
    // erases. The two router flavours differ only in whether appUserId is already
    // guaranteed — requireAuth is what establishes that at runtime, not the mount.
    app.route(path, router as AppHonoOptional);
  }

  return app;
}
