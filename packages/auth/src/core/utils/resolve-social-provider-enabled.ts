import {
  SOCIAL_PROVIDER_ENV_CONFIGS,
  SocialProviderId,
} from "./social-provider.constants.js";

/**
 * Returns whether the provider is enabled by its environment configuration.
 * @param provider - Authentication provider identifier.
 * @returns Whether the provider is enabled by its environment configuration.
 */
export function resolveSocialProviderEnabled(
  provider: SocialProviderId,
): boolean {
  const value = process.env[SOCIAL_PROVIDER_ENV_CONFIGS[provider].enabled];

  return value === "true";
}
