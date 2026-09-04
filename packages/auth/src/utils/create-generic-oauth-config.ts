import type { GenericOAuthProviderConfig } from "./generic-oauth-provider-config.type.js";

/** Combines custom Generic OAuth providers with the environment OIDC provider. */
export function createGenericOAuthConfig(
  disableSignUp: boolean,
  configuredProviders: readonly GenericOAuthProviderConfig[] = [],
  oidcConfig?: GenericOAuthProviderConfig,
): GenericOAuthProviderConfig[] {
  const providers = [
    ...configuredProviders,
    ...(oidcConfig ? [oidcConfig] : []),
  ];
  const providerIds = new Set<string>();

  return providers.map((provider) => {
    if (providerIds.has(provider.providerId)) {
      throw new Error(
        `Generic OAuth provider ID "${provider.providerId}" is configured more than once.`,
      );
    }
    providerIds.add(provider.providerId);

    return disableSignUp ? { ...provider, disableSignUp: true } : provider;
  });
}
