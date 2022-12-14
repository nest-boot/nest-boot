import { Context } from "@nest-boot/common";
import i18next, { i18n, TFunction } from "i18next";

export const getTranslation =
  (): TFunction =>
  (...args: Parameters<TFunction>) => {
    const ctx = Context.get();
    return (ctx?.get<i18n>("i18n") ?? i18next).t(...args);
  };
