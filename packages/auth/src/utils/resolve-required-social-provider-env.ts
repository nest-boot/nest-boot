import {
  SOCIAL_PROVIDER_ENV_CONFIGS,
  SocialProviderId,
  SocialProviderRequiredEnvKey,
} from "./social-provider.constants";

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
