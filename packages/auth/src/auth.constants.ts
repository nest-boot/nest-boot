/** @internal Injection token for the private better-auth instance. */
export const AUTH_TOKEN = Symbol("AUTH");

/** Metadata key used by the {@link Public} decorator to mark public routes. */
export const IS_PUBLIC_KEY = Symbol("IS_PUBLIC_KEY");

/** Request-context token for the authenticated API credential. */
export const API_KEY = Symbol("API_KEY");
