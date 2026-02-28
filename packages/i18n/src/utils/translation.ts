import { RequestContext } from "@nest-boot/request-context";
import i18next, { type i18n, type TOptions } from "i18next";

import { I18N } from "../i18n.constants";

/**
 * Translates the given key using the request-scoped i18n instance, or the global i18next fallback.
 * @param key - Translation key or array of keys
 * @param options - Optional i18next translation options
 * @returns The translated string
 */
export const translation = (
  key: string | string[],
  options?: TOptions,
): string => {
  const instance = RequestContext?.get<i18n>(I18N) ?? i18next;

  if (typeof options !== "undefined") {
    return instance.t(key, options);
  }

  return instance.t(key);
};

/** Alias for {@link translation}. */
export const t = translation;
