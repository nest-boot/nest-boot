import { GenericOAuthProviderConfig } from "./generic-oauth-provider-config.type";
import { hasOidcEnvConfig } from "./has-oidc-env-config";
import { isEnvTrue } from "./is-env-true";
import { resolveOidcPrompt } from "./resolve-oidc-prompt";
import { resolveRequiredOidcEnv } from "./resolve-required-oidc-env";

export function createOidcConfig(
  disableSignUp: boolean,
): GenericOAuthProviderConfig | undefined {
  if (!hasOidcEnvConfig()) {
    return undefined;
  }

  return {
    providerId: "oidc",
    clientId: resolveRequiredOidcEnv("AUTH_OIDC_CLIENT_ID"),
    clientSecret: resolveRequiredOidcEnv("AUTH_OIDC_CLIENT_SECRET"),
    discoveryUrl: resolveRequiredOidcEnv("AUTH_OIDC_DISCOVERY_URL"),
    prompt: resolveOidcPrompt(),
    scopes: (process.env.AUTH_OIDC_SCOPES ?? "openid,profile,email").split(","),
    disableSignUp: disableSignUp || isEnvTrue("AUTH_OIDC_DISABLE_SIGNUP"),
  };
}
