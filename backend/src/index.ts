import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { auth } from "./config/auth"; 
import tournaments from "./routes/tournaments.route";
import users from "./routes/user.route";
import matches from "./routes/matches.route";
import disciplines from "./routes/disciplines.route";
import outcomeTypes from "./routes/outcome-types.route";
import outcomeReasons from "./routes/outcome-reasons.route";
import { addUserContext } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { i18nMiddleware } from "./middleware/i18n";
import { createAppHonoOptional } from "./types/hono";

const app = createAppHonoOptional();

// Logger middleware - must be first to log all requests
app.use("*", logger());

// Configuration CORS en mode développement
app.use(
  "*",
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL || "http://localhost:5173"
        : "http://localhost:5173",
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// i18n middleware (must be before routes to set language)
app.use("*", i18nMiddleware);

// Middleware to set user and session from BetterAuth
app.use("*", addUserContext);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/api/user/me", (c) => {
  const session = c.get("session");
  const user = c.get("user");

  if (!user) return c.body(null, 401);

  return c.json({
    session,
    user,
  });
});

app.route("/api/tournaments", tournaments);

app.route("/api/users", users);

app.route("/api/matches", matches);

app.route("/api/disciplines", disciplines);

app.route("/api/outcome-types", outcomeTypes);

app.route("/api/outcome-reasons", outcomeReasons);

// Serve static files from frontend build directory
// Only serve if FRONTEND_BUILD_PATH is configured
const frontendBuildPath = process.env.FRONTEND_BUILD_PATH;
if (frontendBuildPath) {
  // Serve static assets (JS, CSS, images, etc.) for non-API routes
  app.use(
    "/*",
    async (c, next) => {
      const path = c.req.path;
      // Skip API routes - let them pass through
      if (path.startsWith("/api/")) {
        return next();
      }
      // Use serveStatic middleware for non-API routes
      const staticMiddleware = serveStatic({
        root: frontendBuildPath,
        rewriteRequestPath: (p) => {
          // For root path, serve index.html
          if (p === "/") {
            return "/index.html";
          }
          return p;
        },
      });
      return staticMiddleware(c, next);
    }
  );

  // SPA fallback: serve index.html for all non-API routes that don't match a file
  app.get("*", async (c) => {
    const path = c.req.path;
    // Don't handle API routes
    if (path.startsWith("/api/")) {
      return;
    }
    // Serve index.html for SPA routing
    try {
      const Bun = await import("bun");
      const indexHtml = await Bun.file(`${frontendBuildPath}/index.html`).text();
      return c.html(indexHtml);
    } catch (error) {
      console.error("Failed to serve index.html:", error);
      return c.text("Frontend not found", 404);
    }
  });
} else {
  // Fallback route when frontend is not served
  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });
}

// Error handling middleware (must be after all routes)
app.onError(errorHandler);

// Handle uncaught errors and unhandled promise rejections
if (typeof process !== "undefined") {
  process.on("uncaughtException", (err: Error) => {
    console.error("\n" + "=".repeat(80));
    console.error("🚨 UNCAUGHT EXCEPTION");
    console.error("=".repeat(80));
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);
    console.error("=".repeat(80) + "\n");
  });

  process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    console.error("\n" + "=".repeat(80));
    console.error("🚨 UNHANDLED PROMISE REJECTION");
    console.error("=".repeat(80));
    console.error("Reason:", reason);
    if (reason instanceof Error) {
      console.error("Error:", reason.message);
      console.error("Stack:", reason.stack);
    }
    console.error("=".repeat(80) + "\n");
  });
}

// Log server startup
console.log("=".repeat(80));
console.log("✅ Hono server initialized");
console.log("✅ Logger middleware enabled");
console.log("✅ Error handler configured");
if (frontendBuildPath) {
  console.log(`✅ Static files serving enabled from: ${frontendBuildPath}`);
} else {
  console.log("ℹ️  Static files serving disabled (FRONTEND_BUILD_PATH not set)");
}
console.log("=".repeat(80));


export default app;
