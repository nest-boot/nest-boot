import { RequiredOidcEnvName } from "./oidc.constants";

export function resolveRequiredOidcEnv(name: RequiredOidcEnvName): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required when OIDC auth is configured.\n` +
        `Set ${name} environment variable, or remove AUTH_OIDC_* environment variables to disable OIDC auth.`,
    );
  }

  return value;
}
