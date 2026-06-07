import {
  SOCIAL_PROVIDER_ENV_CONFIGS,
  SocialProviderId,
} from "./social-provider.constants";

export function hasSocialProviderCredentialEnvConfig(
  provider: SocialProviderId,
): boolean {
  const config = SOCIAL_PROVIDER_ENV_CONFIGS[provider];

  return (
    process.env[config.clientId] !== undefined ||
    process.env[config.clientSecret] !== undefined
  );
}
