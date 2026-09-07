import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/common.json";
import ptBR from "./locales/pt-BR/common.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      "pt-BR": { common: ptBR },
    },
    ns: ["common"],
    defaultNS: "common",
    fallbackLng: "pt-BR",
    supportedLngs: ["en", "pt-BR"],
    interpolation: { escapeValue: false },
    detection: {
      // Portuguese is the product's default audience — only an explicit
      // in-app language switch (cached to localStorage) should override it.
      order: ["localStorage"],
      lookupLocalStorage: "language",
      caches: ["localStorage"],
    },
  });

export default i18n;
