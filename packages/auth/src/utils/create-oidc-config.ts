import { GenericOAuthProviderConfig } from "./generic-oauth-provider-config.type";
import { isEnvTrue } from "./is-env-true";
import { resolveOidcPrompt } from "./resolve-oidc-prompt";
import { resolveOidcScopes } from "./resolve-oidc-scopes";
import { resolveRequiredOidcEnv } from "./resolve-required-oidc-env";

export function createOidcConfig(
  disableSignUp: boolean,
): GenericOAuthProviderConfig | undefined {
  if (!isEnvTrue("AUTH_OIDC_ENABLED")) {
    return undefined;
  }

  return {
    providerId: "oidc",
    clientId: resolveRequiredOidcEnv("AUTH_OIDC_CLIENT_ID"),
    clientSecret: resolveRequiredOidcEnv("AUTH_OIDC_CLIENT_SECRET"),
    discoveryUrl: resolveRequiredOidcEnv("AUTH_OIDC_DISCOVERY_URL"),
    prompt: resolveOidcPrompt(),
    scopes: resolveOidcScopes(),
    disableSignUp: disableSignUp || isEnvTrue("AUTH_OIDC_DISABLE_SIGN_UP"),
  };
}
