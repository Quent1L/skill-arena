import { Context } from "hono";
import { AppError } from "../types/errors";
import { ZodError } from "zod";
import i18next from "../config/i18n";

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
    console.error("\n" + "=".repeat(80));
    console.error("🚨 ERROR HANDLER TRIGGERED");
    console.error("=".repeat(80));
    console.error("Error Type:", err?.constructor?.name || "Unknown");
    console.error("Error Name:", err?.name || "Unknown");
    console.error("Error Message:", err?.message || "No message");
    console.error("Request:", `${requestInfo.method} ${requestInfo.path}`);
    console.error("URL:", requestInfo.url);
    console.error("IP:", requestInfo.ip);
    if (err?.stack) {
      console.error("Stack Trace:", err.stack);
    }
    console.error("=".repeat(80) + "\n");
  } catch (logError) {
    // If logging fails, try basic console.error
    console.error("CRITICAL: Failed to log error properly:", logError);
    console.error("Original error:", err);
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
    
    // Log AppError with details
    console.error("[AppError]", JSON.stringify({
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
      details: err.details,
      request: requestInfo,
      stack: err.stack,
    }, null, 2));

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

    // Log Zod validation error with details
    console.error("[ValidationError]", JSON.stringify({
      code: "VALIDATION_ERROR",
      statusCode: 400,
      issues: validationIssues,
      request: requestInfo,
      stack: err.stack,
    }, null, 2));

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
  
  // Log unknown error with full details (including actual error message and stack)
  const errorDetails: Record<string, unknown> = {
    code: "UNKNOWN",
    statusCode: 500,
    actualErrorMessage: err.message,
    errorName: err.name,
    request: requestInfo,
    stack: err.stack,
  };

  // Try to extract additional error details if available
  if (err && typeof err === "object") {
    const errObj = err as unknown as Record<string, unknown>;
    if (errObj.code) errorDetails.errorCode = errObj.code;
    if (errObj.detail) errorDetails.errorDetail = errObj.detail;
    if (errObj.hint) errorDetails.errorHint = errObj.hint;
    if (errObj.position) errorDetails.errorPosition = errObj.position;
    if (errObj.where) errorDetails.errorWhere = errObj.where;
    if (errObj.query) errorDetails.errorQuery = errObj.query;
    if (errObj.parameters) errorDetails.errorParameters = errObj.parameters;
  }

  console.error("[UnknownError]", JSON.stringify(errorDetails, null, 2));

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
