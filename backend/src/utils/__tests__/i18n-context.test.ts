import { describe, it, expect } from "bun:test";
import { Hono } from "hono";

import { runWithLang, currentLang } from "../i18n-context";
import { i18nMiddleware } from "../../middleware/i18n";
import { errorHandler } from "../../middleware/error";
import { BadRequestError, ErrorCode } from "../../types/errors";

// Asserts on the resolved language rather than on translated strings: another
// test file mock.module()s ../../config/i18n process-wide, so real translations
// are not reliably available here.
describe("i18n-context", () => {
  it("falls back to fr outside any request", () => {
    expect(currentLang()).toBe("fr");
  });

  it("keeps each async context on its own language when interleaved", async () => {
    const langAfterYield = async (lng: string) =>
      runWithLang(lng, async () => {
        // Yields control so the other branch runs in between: this is exactly
        // what a mutated global language would get wrong.
        await new Promise((resolve) => setTimeout(resolve, 0));
        return currentLang();
      });

    const [fr, en] = await Promise.all([langAfterYield("fr"), langAfterYield("en")]);

    expect(fr).toBe("fr");
    expect(en).toBe("en");
  });

  it("resolves the request language from Accept-Language and exposes it downstream", async () => {
    const app = new Hono();
    app.use("*", i18nMiddleware);
    app.get("/lang", (c) => c.json({ inHandler: currentLang(), fromContext: c.get("lang") }));

    const res = await app.request("/lang", { headers: { "Accept-Language": "en-GB,en;q=0.9" } });

    expect(await res.json()).toEqual({ inHandler: "en", fromContext: "en" });
  });

  it("falls back to fr on an unsupported language", async () => {
    const app = new Hono();
    app.use("*", i18nMiddleware);
    app.get("/lang", (c) => c.json({ lang: currentLang() }));

    const res = await app.request("/lang", { headers: { "Accept-Language": "de" } });

    expect(await res.json()).toEqual({ lang: "fr" });
  });

  it("still sees the request language inside the error handler", async () => {
    let langSeenByErrorHandler: string | null = null;
    const app = new Hono();
    app.use("*", i18nMiddleware);
    app.onError((err, c) => {
      // The handler runs after the throw unwinds the chain — the assertion is
      // that the async context survives that unwind.
      langSeenByErrorHandler = currentLang();
      return errorHandler(err, c);
    });
    app.get("/boom", () => {
      throw new BadRequestError(ErrorCode.UNKNOWN);
    });

    await app.request("/boom", { headers: { "Accept-Language": "en" } });

    expect(langSeenByErrorHandler).toBe("en");
  });
});
