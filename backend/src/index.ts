import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic,  upgradeWebSocket, websocket } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { auth } from "./config/auth";
import tournaments from "./routes/tournaments.route";
import users from "./routes/user.route";
import matches from "./routes/matches.route";
import disciplines from "./routes/disciplines.route";
import outcomeTypes from "./routes/outcome-types.route";
import outcomeReasons from "./routes/outcome-reasons.route";
import notifications from "./routes/notification.route";
import config from "./routes/config.route";
import { addUserContext } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { i18nMiddleware } from "./middleware/i18n";
import { createAppHonoOptional } from "./types/hono";
import { webSocketService } from "./services/websocket.service";

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

app.route("/api", notifications);

app.route("/api/config", config);

app.get(
  "/api/ws",
  upgradeWebSocket(async (c) => {
    const user = c.get("user");
    const session = c.get("session");
    
    console.log('[WS] Upgrade request - BetterAuth User:', user?.id, 'Session:', session?.id);
    
    if (!user) {
      console.error('[WS] No user in context, rejecting connection');
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    
    // Convert BetterAuth user ID to App user ID
    const { userService } = await import('./services/user.service');
    const appUserId = await userService.getOrCreateAppUser(
      user.id,
      user.name || user.email
    );
    
    console.log(`[WS] BetterAuth user ${user.id} mapped to App user ${appUserId}`);
    
    return {
      onOpen(_event, ws) {
        console.log(`[WS] App user ${appUserId} connected (BetterAuth: ${user.id})`);
        webSocketService.handleConnection(ws, appUserId);
      },
      onClose(_event, ws) {
        console.log(`[WS] App user ${appUserId} disconnected`);
        webSocketService.handleClose(ws, appUserId);
      },
      onError(event, _ws) {
        console.error(`[WS] Error for app user ${appUserId}:`, event);
      }
    };
  })
);

// Serve static files from frontend build directory
// Only serve if FRONTEND_BUILD_PATH is configured
const frontendBuildPath = process.env.FRONTEND_BUILD_PATH;
if (frontendBuildPath) {
  // Serve static files (JS, CSS, images, etc.)
  app.use("/*", async (c, next) => {
    const path = c.req.path;
    // Skip API routes - let them pass through
    if (path.startsWith("/api/")) {
      return next();
    }

    // Check if file exists (for assets like JS, CSS, images)
    const filePath = `${frontendBuildPath}${path}`;
    const file = Bun.file(filePath);

    if (await file.exists()) {
      // File exists, serve it
      const staticMiddleware = serveStatic({
        root: frontendBuildPath,
      });
      return staticMiddleware(c, next);
    }

    // File doesn't exist, fallback to index.html for SPA routing
    const indexFile = Bun.file(`${frontendBuildPath}/index.html`);
    if (await indexFile.exists()) {
      const indexHtml = await indexFile.text();
      return c.html(indexHtml);
    } else {
      console.error("index.html not found in:", frontendBuildPath);
      return c.text("Frontend not found", 404);
    }
  });
} else {
  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });
}

app.onError(errorHandler);

if (typeof process !== "undefined") {
  process.on("uncaughtException", (err: Error) => {
    console.error("\n" + "=".repeat(80));
    console.error("🚨 UNCAUGHT EXCEPTION");
    console.error("=".repeat(80));
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);
    console.error("=".repeat(80) + "\n");
  });

  process.on(
    "unhandledRejection",
    (reason: unknown, _promise: Promise<unknown>) => {
      console.error("\n" + "=".repeat(80));
      console.error("🚨 UNHANDLED PROMISE REJECTION");
      console.error("=".repeat(80));
      console.error("Reason:", reason);
      if (reason instanceof Error) {
        console.error("Error:", reason.message);
        console.error("Stack:", reason.stack);
      }
      console.error("=".repeat(80) + "\n");
    }
  );
}

console.log("=".repeat(80));
console.log("✅ Hono server initialized");
console.log("✅ Logger middleware enabled");
console.log("✅ Error handler configured");
if (frontendBuildPath) {
  console.log(`✅ Static files serving enabled from: ${frontendBuildPath}`);
} else {
  console.log(
    "ℹ️  Static files serving disabled (FRONTEND_BUILD_PATH not set)"
  );
}
console.log("=".repeat(80));

export default {
  fetch: app.fetch,
  websocket,
};
