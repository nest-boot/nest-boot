import {
  SOCIAL_PROVIDER_ENV_CONFIGS,
  SocialProviderId,
  SocialProviderRequiredEnvKey,
} from "./social-provider.constants.js";

/**
 * Returns nonempty value of the required provider credential.
 * @param provider - Authentication provider identifier.
 * @param key - Key identifying the requested configuration value.
 * @returns Nonempty value of the required provider credential.
 */
export function resolveRequiredSocialProviderEnv(
  provider: SocialProviderId,
  key: SocialProviderRequiredEnvKey,
): string {
  const config = SOCIAL_PROVIDER_ENV_CONFIGS[provider];
  const name = config[key];
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required for ${config.displayName} auth.\n` +
        `Set ${name} environment variable, or set ${config.enabled}=false to disable ${config.displayName} auth.`,
    );
  }

  return value;
}
