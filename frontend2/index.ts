import type { AppType } from "../backend/src/index";
import { hc } from "hono/client";

const client = hc<AppType>("http://localhost:8787/");

const res = await client.posts.$post({
  form: {
    title: "Hello",
    body: "Hono is a cool project",
  },
});
