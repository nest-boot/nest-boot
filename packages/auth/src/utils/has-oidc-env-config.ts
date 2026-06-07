import { OIDC_ENV_NAMES } from "./oidc.constants";

export function hasOidcEnvConfig(): boolean {
  return OIDC_ENV_NAMES.some((name) => process.env[name] !== undefined);
}
