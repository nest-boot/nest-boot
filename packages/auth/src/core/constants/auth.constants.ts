/**
 * Injection token for the private better-auth instance.
 * @internal
 */
export const AUTH_TOKEN = Symbol("AUTH");

/** Metadata key used by the {@link Public} decorator to mark public routes. */
export const IS_PUBLIC_KEY = Symbol("IS_PUBLIC_KEY");

/** Request-context token for the independently selected workspace target. */
export const SELECTED_WORKSPACE = Symbol("SELECTED_WORKSPACE");
