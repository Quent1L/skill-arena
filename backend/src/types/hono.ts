import { Hono } from "hono";
import { auth } from "../config/auth";

/**
 * Type commun pour les variables de contexte Hono
 */
export type AppVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  appUserId: string;
};

/**
 * Type commun pour les variables de contexte Hono (avec appUserId optionnel)
 */
export type AppVariablesOptional = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  appUserId: string | null;
};

/**
 * Type Hono avec les variables d'application standard
 */
export type AppHono = Hono<{
  Variables: AppVariables;
}>;

/**
 * Type Hono avec les variables d'application (appUserId optionnel)
 */
export type AppHonoOptional = Hono<{
  Variables: AppVariablesOptional;
}>;

/**
 * Factory pour créer une nouvelle instance Hono avec les types appropriés
 */
export function createAppHono(): AppHono {
  return new Hono<{ Variables: AppVariables }>();
}

/**
 * Factory pour créer une nouvelle instance Hono avec appUserId optionnel
 */
export function createAppHonoOptional(): AppHonoOptional {
  return new Hono<{ Variables: AppVariablesOptional }>();
}
