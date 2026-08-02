import { cors } from "hono/cors";
import { serveStatic, upgradeWebSocket, websocket } from "hono/bun";
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
import invitations from "./routes/invitations.route";
import adminInvitations from "./routes/admin/invitations.route";
import adminOrganizations from "./routes/admin/organizations.route";
import adminRules from "./routes/admin/rules.route";
import adminUsers from "./routes/admin/users.route";
import gameRulesRouter from "./routes/game-rules.route";
import teamsRouter from "./routes/teams.route";
import rankedRouter from "./routes/ranked.route";
import { addUserContext } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { i18nMiddleware } from "./middleware/i18n";
import { createAppHonoOptional } from "./types/hono";
import { webSocketService } from "./services/websocket.service";
import { emailService } from "./services/email.service";
import { userService } from "./services/user.service";
import { startJobScheduler } from "./jobs/scheduler";
import { runMigrations } from "./utils/migrate";
import { initializeAdminIfNeeded } from "./utils/init-admin";
import { logger } from "./utils/logger";
import { run, type Runner } from "graphile-worker";
import { taskList } from "./workers/mmr-recalculation.worker";

await runMigrations();
await initializeAdminIfNeeded();

// Non-blocking canary: surfaces a broken SMTP setup at boot instead of at the first
// password reset. verifyConnection() swallows its own error and returns false.
if (!process.env.SMTP_HOST) {
  logger.warn("SMTP_HOST not set — password reset emails cannot be sent");
} else {
  void emailService.verifyConnection().then((ok) => {
    if (!ok) {
      logger.warn("SMTP unreachable — password reset emails will fail");
    }
  });
}

let workerRunner: Runner | null = null;
try {
  workerRunner = await run({
    connectionString: process.env.DATABASE_URL!,
    taskList,
    concurrency: 1,
  });
  logger.info("Graphile Worker started");
} catch (err) {
  logger.error({ err }, "Failed to start Graphile Worker — MMR jobs will not be processed");
}

const app = createAppHonoOptional();

// HTTP request logger middleware - logs at debug level
app.use("/api/*", async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  logger.debug(`<-- ${method} ${path}`);
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.debug(`--> ${method} ${path} ${c.res.status} ${ms}ms`);
});

// CORS configuration in development mode
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

app.route("/api/invitations", invitations);

app.route("/api/admin/invitations", adminInvitations);

app.route("/api/admin/organizations", adminOrganizations);

app.route("/api/admin/rules", adminRules);

app.route("/api/admin/users", adminUsers);

app.route("/api/game-rules", gameRulesRouter);

app.route("/api/tournaments", teamsRouter);

app.route("/api/ranked", rankedRouter);

app.get(
  "/api/ws",
  upgradeWebSocket(async (c) => {
    const user = c.get("user");
    const session = c.get("session");
    
    logger.debug(`[WS] Upgrade request - BetterAuth User: ${user?.id} Session: ${session?.id}`);
    
    if (!user) {
      logger.error('[WS] No user in context, rejecting connection');
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    
    const appUserId = await userService.getOrCreateAppUser(
      user.id,
      user.name || user.email
    );
    
    logger.debug(`[WS] BetterAuth user ${user.id} mapped to App user ${appUserId}`);
    
    return {
      onOpen(_event, ws) {
        logger.debug(`[WS] App user ${appUserId} connected (BetterAuth: ${user.id})`);
        webSocketService.handleConnection(ws, appUserId);
      },
      onMessage(event, _ws) {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.event === 'subscribe_tournament' && msg.tournamentId) {
            webSocketService.subscribeToTournament(msg.tournamentId, appUserId);
          } else if (msg.event === 'unsubscribe_tournament' && msg.tournamentId) {
            webSocketService.unsubscribeFromTournament(msg.tournamentId, appUserId);
          }
        } catch {}
      },
      onClose(_event, ws) {
        logger.debug(`[WS] App user ${appUserId} disconnected`);
        webSocketService.handleClose(ws, appUserId);
        webSocketService.unsubscribeUserFromAll(appUserId);
      },
      onError(event, _ws) {
        logger.error(`[WS] Error for app user ${appUserId}: %o`, event);
      }
    };
  })
);

// Serve static files from frontend build directory
// Only serve if FRONTEND_BUILD_PATH is configured
const frontendBuildPath = process.env.FRONTEND_BUILD_PATH;
let _indexHtmlCache: string | null = null;
/** Everything vite emits under /assets/ carries a content hash, so it can never go stale. */
const HASHED_ASSET_PATH = /^\/assets\//;

if (frontendBuildPath) {
  // Serve static assets (JS, CSS, images…) — serveStatic calls next() when file not found
  app.use(
    "/*",
    serveStatic({
      root: frontendBuildPath,
      onFound: (_path, c) => {
        // index.html, sw.js, manifest.webmanifest and version.json must revalidate on every
        // load, otherwise a client can stay pinned to a deployment it has already replaced.
        c.header(
          "Cache-Control",
          HASHED_ASSET_PATH.test(c.req.path)
            ? "public, max-age=31536000, immutable"
            : "no-cache"
        );
      }
    })
  );

  // Reaching this point for a hashed asset means the file is genuinely gone (usually a client
  // still running a previous deployment). Answering with the SPA shell hands the browser HTML
  // where it expects a font or a script: fonts then fail to decode and render as tofu, and
  // scripts surface as "Unexpected token '<'". Fail honestly instead.
  app.use("/*", async (c, next) => {
    if (HASHED_ASSET_PATH.test(c.req.path)) return c.text("Not found", 404);
    return next();
  });

  // SPA fallback: all unmatched routes serve index.html (cached in memory)
  app.use("/*", async (c) => {
    if (_indexHtmlCache === null) {
      const indexFile = Bun.file(`${frontendBuildPath}/index.html`);
      if (!(await indexFile.exists())) {
        logger.error("index.html not found in: %s", frontendBuildPath);
        return c.text("Frontend not found", 404);
      }
      _indexHtmlCache = await indexFile.text();
    }
    c.header("Cache-Control", "no-cache");
    return c.html(_indexHtmlCache);
  });
} else {
  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });
}

app.onError(errorHandler);

if (typeof process !== "undefined") {
  process.on("uncaughtException", (err: Error) => {
    logger.fatal(err, "UNCAUGHT EXCEPTION");
  });

  process.on(
    "unhandledRejection",
    (reason: unknown, _promise: Promise<unknown>) => {
      logger.fatal({ reason }, "UNHANDLED PROMISE REJECTION");
    }
  );

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    cronJob.stop();
    if (workerRunner) await workerRunner.stop();
    process.exit(0);
  });
}

logger.info("Hono server initialized");
logger.info("Log level: %s", logger.level);
logger.info("Error handler configured");
if (frontendBuildPath) {
  logger.info(`Static files serving enabled from: ${frontendBuildPath}`);
} else {
  logger.info("Static files serving disabled (FRONTEND_BUILD_PATH not set)");
}

// Start job scheduler for auto-finalization
const cronJob = startJobScheduler();

export default {
  fetch: app.fetch,
  websocket,
};
