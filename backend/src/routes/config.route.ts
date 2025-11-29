import { Hono } from "hono";

const configRoute = new Hono();

configRoute.get("/", (c) => {
  return c.json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
  });
});

export default configRoute;
