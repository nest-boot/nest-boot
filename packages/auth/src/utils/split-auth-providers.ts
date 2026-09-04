import { socialProviderList } from "better-auth/social-providers";

import type {
  AuthModuleProvider,
  AuthModuleSocialProviders,
} from "../auth-module-options.interface.js";
import type { GenericOAuthProviderConfig } from "./generic-oauth-provider-config.type.js";

const BUILT_IN_PROVIDER_IDS = new Set<string>(socialProviderList);

interface SplitAuthProvidersResult {
  genericOAuthProviders: GenericOAuthProviderConfig[];
  socialProviders: AuthModuleSocialProviders | undefined;
}

/** Splits the unified public provider list into Better Auth configurations. */
export function splitAuthProviders(
  providers: readonly AuthModuleProvider[] = [],
): SplitAuthProvidersResult {
  const providerIds = new Set<string>();
  const genericOAuthProviders: GenericOAuthProviderConfig[] = [];
  const socialProviders: Record<string, unknown> = {};

  for (const provider of providers) {
    const { id, ...config } = provider;
    const providerId = id.trim();
    if (!providerId) {
      throw new Error("Authentication provider ID must not be empty.");
    }
    if (providerIds.has(providerId)) {
      throw new Error(
        `Authentication provider ID "${providerId}" is configured more than once.`,
      );
    }
    providerIds.add(providerId);

    if (BUILT_IN_PROVIDER_IDS.has(providerId)) {
      socialProviders[providerId] = config;
    } else {
      genericOAuthProviders.push({
        ...config,
        providerId,
      } as GenericOAuthProviderConfig);
    }
  }

  return {
    genericOAuthProviders,
    socialProviders:
      Object.keys(socialProviders).length > 0
        ? (socialProviders as AuthModuleSocialProviders)
        : undefined,
  };
}
