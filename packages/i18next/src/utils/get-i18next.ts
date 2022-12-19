import { RequestContext } from "@nest-boot/request-context";
import i18next, { i18n as I18next } from "i18next";

export const getI18next = (): I18next => {
  const ctx = RequestContext.get();
  return ctx?.get("i18n") ?? i18next;
};
