import { Context } from "hono";
import { AppError } from "../types/errors";
import { ZodError } from "zod";
import i18next from "../config/i18n";
import { logger } from "../utils/logger";

export async function errorHandler(err: Error, c: Context) {
  // Extract request information for logging (do this first, before any other operations)
  let requestInfo;
  try {
    requestInfo = {
      method: c.req.method,
      url: c.req.url,
      path: c.req.path,
      userAgent: c.req.header("user-agent") || "unknown",
      ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown",
    };
  } catch (e) {
    requestInfo = {
      method: "UNKNOWN",
      url: "UNKNOWN",
      path: "UNKNOWN",
      userAgent: "UNKNOWN",
      ip: "UNKNOWN",
    };
  }

  // Always log the error first, even if it fails later
  try {
    logger.error({ err, request: requestInfo }, "ERROR HANDLER TRIGGERED");
  } catch (logError) {
    logger.error({ logError, err }, "CRITICAL: Failed to log error properly");
  }

  // Get i18n instance from context or use default
  let i18n;
  try {
    i18n = c.get("i18n") || i18next;
  } catch (e) {
    i18n = i18next;
  }

  // Handle AppError (our custom errors)
  if (err instanceof AppError) {
    const message = i18n.t(`errors.${err.code}`, err.details || {});
    
    logger.error({ err, request: requestInfo }, "[AppError] %s", err.code);

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
    const validationIssues = err.issues.map((e: any) => ({
      path: e.path.join("."),
      message: e.message,
    }));

    logger.error({ err, issues: validationIssues, request: requestInfo }, "[ValidationError]");

    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message,
          details: {
            issues: validationIssues,
          },
        },
      },
      400
    );
  }

  // Handle unknown errors
  // Use generic message for response, but log full details
  const genericMessage = i18n.t("errors.UNKNOWN");
  
  logger.error({ err, request: requestInfo }, "[UnknownError]");

  // Return only generic error message to client (no implementation details)
  return c.json(
    {
      error: {
        code: "UNKNOWN",
        message: genericMessage,
      },
    },
    500
  );
}
