/** @internal Injection token for the private better-auth instance. */
export const AUTH_TOKEN = Symbol("AUTH");

/** Request-context token for the API key used to authenticate a request. */
export const CURRENT_API_KEY = Symbol("CURRENT_API_KEY");

/** Request-context token for the workspace selected for a request. */
export const CURRENT_WORKSPACE = Symbol("CURRENT_WORKSPACE");

/** Request-context token for the current user's workspace membership. */
export const CURRENT_WORKSPACE_MEMBER = Symbol("CURRENT_WORKSPACE_MEMBER");

/** Metadata key used by the {@link Public} decorator to mark public routes. */
export const IS_PUBLIC_KEY = Symbol("IS_PUBLIC_KEY");
