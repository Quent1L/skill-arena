import { Context } from "hono";
import { AppError } from "../types/errors";
import { ZodError } from "zod";
import i18next from "../config/i18n";

export async function errorHandler(err: Error, c: Context) {
  console.error("Error occurred:", err);

  // Get i18n instance from context or use default
  const i18n = c.get("i18n") || i18next;

  // Handle AppError (our custom errors)
  if (err instanceof AppError) {
    const message = i18n.t(`errors.${err.code}`, err.details || {});
    return c.json(
      {
        error: {
          code: err.code,
          message,
          details: err.details,
        },
      },
      err.statusCode as any
    );
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const message = i18n.t("errors.VALIDATION_ERROR");
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message,
          details: {
            issues: err.issues.map((e: any) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          },
        },
      },
      400
    );
  }

  // Handle unknown errors
  const message = i18n.t("errors.UNKNOWN");
  return c.json(
    {
      error: {
        code: "UNKNOWN",
        message: err.message || message,
      },
    },
    500
  );
}
