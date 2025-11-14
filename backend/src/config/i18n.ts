import i18next from "i18next";
import { readFileSync } from "fs";
import { join } from "path";

// Load translations
const frTranslation = JSON.parse(
  readFileSync(join(__dirname, "../locales/fr.json"), "utf-8")
);
const enTranslation = JSON.parse(
  readFileSync(join(__dirname, "../locales/en.json"), "utf-8")
);

// Initialize i18next
i18next.init({
  lng: "fr", // default language
  fallbackLng: "fr",
  resources: {
    fr: { translation: frTranslation },
    en: { translation: enTranslation },
  },
});

export default i18next;
