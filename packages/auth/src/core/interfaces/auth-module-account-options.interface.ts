import type { AuthModuleAccountLinkingOptions } from "./auth-module-account-linking-options.interface.js";

/** OAuth account persistence and state-validation options. */
export interface AuthModuleAccountOptions {
  /** Refreshes stored provider account data during sign-in. */
  updateAccountOnSignIn?: boolean;
  /** Account-linking behavior. */
  accountLinking?: AuthModuleAccountLinkingOptions;
  /** Encrypts persisted OAuth token values. */
  encryptOAuthTokens?: boolean;
  /** Disables OAuth state Cookie validation. Use only in exceptional deployments. */
  skipStateCookieCheck?: boolean;
  /** Persistence strategy for OAuth state. */
  storeStateStrategy?: "cookie" | "database";
  /** Stores provider account data in an encrypted Cookie. */
  storeAccountCookie?: boolean;
}
