import { getRuntimeContext } from "@nest-boot/common";
import i18next, { TFunction } from "i18next";

export const getTranslation =
  (): TFunction =>
  (...args: Parameters<TFunction>) => {
    const ctx = getRuntimeContext();
    return (ctx?.i18n || i18next).t(...args);
  };
