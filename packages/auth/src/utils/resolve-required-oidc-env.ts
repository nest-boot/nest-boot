import { RequiredOidcEnvName } from "./oidc.constants.js";

/**
 * Returns nonempty value of the required OIDC setting.
 * @param name - Name used to identify the resource.
 * @returns Nonempty value of the required OIDC setting.
 */
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
