import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./config/auth"; // path to your auth file
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

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

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
console.log("=".repeat(80));


export default app;
