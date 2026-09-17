import type { AuthMaybePromise } from "../types/auth-maybe-promise.type.js";

/** Account-linking behavior for OAuth identities. */
export interface AuthModuleAccountLinkingOptions {
  /** Whether account linking is enabled. */
  enabled?: boolean;
  /** Requires users to link identities explicitly. */
  disableImplicitLinking?: boolean;
  /** Requires a verified local email before implicit linking. */
  requireLocalEmailVerified?: boolean;
  /** Providers trusted for account linking. */
  trustedProviders?:
    | string[]
    | ((request?: Request) => AuthMaybePromise<string[]>);
  /** Allows linking a provider identity with a different email address. */
  allowDifferentEmails?: boolean;
  /** Allows unlinking the final authentication account. */
  allowUnlinkingAll?: boolean;
  /** Copies provider profile information to the local user when linking. */
  updateUserInfoOnLink?: boolean;
}
