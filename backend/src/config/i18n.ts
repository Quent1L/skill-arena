import i18next from "i18next";
import frLocale from '../locales/fr.json';
import enLocale from '../locales/en.json';

// Load translations (already parsed as objects by Bun/TypeScript JSON imports)
const frTranslation = frLocale;
const enTranslation = enLocale;


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
