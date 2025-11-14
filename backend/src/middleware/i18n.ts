import { Context, Next } from "hono";
import i18next from "../config/i18n";

export async function i18nMiddleware(c: Context, next: Next) {
  // Get language from Accept-Language header or query param
  const langFromHeader = c.req
    .header("Accept-Language")
    ?.split(",")[0]
    ?.split("-")[0];
  const langFromQuery = c.req.query("lang");
  const lang = langFromQuery || langFromHeader || "fr";

  // Set language for this request
  const supportedLanguages = ["fr", "en"];
  const selectedLang = supportedLanguages.includes(lang) ? lang : "fr";

  i18next.changeLanguage(selectedLang);

  // Store i18n instance in context for use in error handler
  c.set("i18n", i18next);
  c.set("lang", selectedLang);

  await next();
}
