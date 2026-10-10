import type { AuthModuleSessionCookieCacheRefreshOptions } from "./auth-module-session-cookie-cache-refresh-options.interface.js";

/** Session Cookie cache options. */
export interface AuthModuleSessionCookieCacheOptions {
  /** Whether session Cookie caching is enabled. */
  enabled?: boolean;
  /** Cached session lifetime in seconds. */
  maxAge?: number;
  /** Cookie cache encoding strategy. */
  strategy?: "compact" | "jwe" | "jwt";
  /** Enables or configures stateless cache refresh. */
  refreshCache?: boolean | AuthModuleSessionCookieCacheRefreshOptions;
  /** Cache version used to invalidate previously issued values. */
  version?:
    | string
    | ((
        session: Record<string, unknown>,
        user: Record<string, unknown>,
      ) => string)
    | ((
        session: Record<string, unknown>,
        user: Record<string, unknown>,
      ) => Promise<string>);
}
