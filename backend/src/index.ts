import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";
import { auth } from "./config/auth"; // path to your auth file
import tournaments from "./routes/tournaments.route";
import users from "./routes/user.route";
import matches from "./routes/matches.route";
import { addUserContext } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { i18nMiddleware } from "./middleware/i18n";
import { createAppHonoOptional } from "./types/hono";

const app = createAppHonoOptional();

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

// Mount tournament routes
app.route("/api/tournaments", tournaments);

// Mount user routes
app.route("/api/users", users);

// Mount match routes
app.route("/api/matches", matches);

// Error handling middleware (must be after all routes)
app.onError(errorHandler);

const route = app.post(
  "/posts",
  zValidator(
    "form",
    z.object({
      title: z.string(),
      body: z.string(),
    })
  ),
  (c) => {
    // ...
    return c.json(
      {
        ok: true,
        message: "Created!",
      },
      201
    );
  }
);

export default app;
export type AppType = typeof route;
