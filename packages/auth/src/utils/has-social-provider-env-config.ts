import {
  SOCIAL_PROVIDER_ENV_CONFIGS,
  SocialProviderId,
} from "./social-provider.constants.js";

/**
 * Returns whether any environment setting exists for the provider.
 * @param provider - Authentication provider identifier.
 * @returns Whether any environment setting exists for the provider.
 */
export function hasSocialProviderEnvConfig(
  provider: SocialProviderId,
): boolean {
  return SOCIAL_PROVIDER_ENV_CONFIGS[provider].envNames.some(
    (name) => process.env[name] !== undefined,
  );
}
