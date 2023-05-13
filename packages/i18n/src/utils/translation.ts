import { RequestContext } from "@nest-boot/request-context";
import i18next, { type i18n, type TOptions } from "i18next";

import { I18N } from "../i18n.constants";

export const translation = (
  key: string | string[],
  options?: TOptions
): string => {
  const instance = RequestContext?.get<i18n>(I18N) ?? i18next;

  if (typeof options !== "undefined") {
    return instance.t(key, options);
  }

  return instance.t(key);
};

export const t = translation;
