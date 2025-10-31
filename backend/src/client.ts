import type { AppType } from ".";
import { hc } from "hono/client";

export const client = hc<AppType>("http://localhost:8787/");

const res = await client.posts.$post({
  form: {
    title: "Hello",
    body: "Hono is a cool project",
  },
});
