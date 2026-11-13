import type { AuthModuleSessionCookieCacheOptions } from "./auth-module-session-cookie-cache-options.interface.js";

/** Session lifecycle and Cookie cache options. */
export interface AuthModuleSessionOptions {
  /** Session lifetime in seconds. */
  expiresIn?: number;
  /** Session refresh interval in seconds. */
  updateAge?: number;
  /** Disables automatic session refresh. */
  disableSessionRefresh?: boolean;
  /** Defers session refresh writes to POST requests. */
  deferSessionRefresh?: boolean;
  /** Session Cookie cache configuration. */
  cookieCache?: AuthModuleSessionCookieCacheOptions;
  /** Maximum session age considered fresh for sensitive operations. */
  freshAge?: number;
}
