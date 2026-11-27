import { RequestContext } from "@nest-boot/request-context";
import i18next, { type i18n, type TOptions } from "i18next";

import { I18N } from "../i18n.constants.js";

let defaultInstance: i18n | undefined;

/**
 * Sets or clears the module-initialized fallback i18n instance used outside a RequestContext.
 * @param instance - Configured i18n instance or `undefined` on shutdown
 * @internal
 */
export function setDefaultI18nInstance(instance: i18n | undefined): void {
  defaultInstance = instance;
}

/**
 * Gets the current module-initialized fallback i18n instance, if any.
 * @returns Current fallback i18n instance or `undefined`
 * @internal
 */
export function getDefaultI18nInstance(): i18n | undefined {
  return defaultInstance;
}

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
  const instance =
    (RequestContext.isActive() ? RequestContext.get<i18n>(I18N) : undefined) ??
    defaultInstance ??
    i18next;

  if (typeof options !== "undefined") {
    return instance.t(key, options);
  }

  return instance.t(key);
};

/** Alias for {@link translation}. */
export const t = translation;
