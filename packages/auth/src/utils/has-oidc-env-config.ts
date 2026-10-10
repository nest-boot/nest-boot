import { OIDC_ENV_NAMES } from "./oidc.constants.js";

/**
 * Returns whether any OIDC environment variable is configured.
 * @returns Whether any OIDC environment variable is configured.
 */
export function hasOidcEnvConfig(): boolean {
  return OIDC_ENV_NAMES.some((name) => process.env[name] !== undefined);
}
