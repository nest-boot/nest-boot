import {
  SOCIAL_PROVIDER_ENV_CONFIGS,
  SocialProviderId,
} from "./social-provider.constants";

export function hasSocialProviderEnvConfig(
  provider: SocialProviderId,
): boolean {
  return SOCIAL_PROVIDER_ENV_CONFIGS[provider].envNames.some(
    (name) => process.env[name] !== undefined,
  );
}
