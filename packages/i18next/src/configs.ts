import { InitOptions } from "i18next";
import path from "path";

export const recommendedI18NextConfig: InitOptions = {
  backend: {
    loadPath: path.join(process.cwd(), "locales/{{lng}}/{{ns}}.json"),
    addPath: path.join(process.cwd(), "locales/{{lng}}/{{ns}}.json"),
  },
  fallbackLng: "en",
  keySeparator: false,
  interpolation: {
    escapeValue: false,
  },
};
