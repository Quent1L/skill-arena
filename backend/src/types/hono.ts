import { Hono } from "hono";
import { auth } from "../config/auth";
import type { ApiVersion } from "../api/versions";

/**
 * Common type for Hono context variables
 */
export type AppVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  appUserId: string;
  lang: string;
  /** Major API version resolved from the accept-version header. */
  apiVersion: ApiVersion;
};

/**
 * Common type for Hono context variables (with optional appUserId)
 */
export type AppVariablesOptional = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  appUserId: string | null;
  lang: string;
  /** Major API version resolved from the accept-version header. */
  apiVersion: ApiVersion;
};

/**
 * Hono type with standard app variables
 */
export type AppHono = Hono<{
  Variables: AppVariables;
}>;

/**
 * Hono type with app variables (optional appUserId)
 */
export type AppHonoOptional = Hono<{
  Variables: AppVariablesOptional;
}>;

/**
 * Factory to create a new Hono instance with the appropriate types
 */
export function createAppHono(): AppHono {
  return new Hono<{ Variables: AppVariables }>();
}

/**
 * Factory to create a new Hono instance with optional appUserId
 */
export function createAppHonoOptional(): AppHonoOptional {
  return new Hono<{ Variables: AppVariablesOptional }>();
}
