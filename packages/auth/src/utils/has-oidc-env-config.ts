import { OIDC_ENV_NAMES } from "./oidc.constants.js";

export function hasOidcEnvConfig(): boolean {
  return OIDC_ENV_NAMES.some((name) => process.env[name] !== undefined);
}
