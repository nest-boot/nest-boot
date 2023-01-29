import { RequestContext } from "@nest-boot/request-context";
import i18next, { i18n, TFunction } from "i18next";

export const getTranslation =
  (): TFunction =>
  (...args: Parameters<TFunction>) => {
    return (RequestContext?.get<i18n>("i18n") ?? i18next).t(...args);
  };
