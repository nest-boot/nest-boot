import { RequiredOidcEnvName } from "./oidc.constants.js";

export function resolveRequiredOidcEnv(name: RequiredOidcEnvName): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required when OIDC auth is configured.\n` +
        `Set ${name} environment variable, or set AUTH_OIDC_ENABLED=false to disable OIDC auth.`,
    );
  }

  return value;
}
