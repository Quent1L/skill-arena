import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

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
