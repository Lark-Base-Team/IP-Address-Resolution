import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import translationEN from "./locales/en.json";
import translationZH from "./locales/zh.json";

export function initI18n(lang: "en" | "zh") {
  i18n.use(initReactI18next).init({
    resources: {
      en: {
        translation: translationEN,
      },
      zh: {
        translation: translationZH,
      },
    },
    lng: lang, //Default Language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
}
