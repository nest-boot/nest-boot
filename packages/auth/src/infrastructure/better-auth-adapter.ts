import type { createAuthInstance } from "./create-auth-instance.js";

type AuthInstance = ReturnType<typeof createAuthInstance>;

/** The upstream API surface consumed by application services. @internal */
export type BetterAuthAdapter = Pick<AuthInstance, "$context"> & {
  api: Pick<
    AuthInstance["api"],
    | "accountInfo"
    | "changeEmail"
    | "changePassword"
    | "deleteUser"
    | "getAccessToken"
    | "getSession"
    | "linkSocialAccount"
    | "listSessions"
    | "listUserAccounts"
    | "refreshToken"
    | "requestPasswordReset"
    | "resetPassword"
    | "revokeOtherSessions"
    | "revokeSession"
    | "revokeSessions"
    | "sendVerificationEmail"
    | "setPassword"
    | "signInEmail"
    | "signInSocial"
    | "signOut"
    | "signUpEmail"
    | "unlinkAccount"
    | "updateUser"
    | "verifyPassword"
  >;
};

/**
 * Adapts the untyped Nest injection boundary once, using the factory's upstream types.
 * Domain result normalization and response cookies remain in services and applyAuthResponseCookies.
 * @internal
 */
export function adaptBetterAuth(auth: unknown): BetterAuthAdapter {
  return auth as BetterAuthAdapter;
}
