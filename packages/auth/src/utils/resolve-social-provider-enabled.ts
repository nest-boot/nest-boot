import {
  SOCIAL_PROVIDER_ENV_CONFIGS,
  SocialProviderId,
} from "./social-provider.constants";

export function resolveSocialProviderEnabled(
  provider: SocialProviderId,
): boolean {
  const value = process.env[SOCIAL_PROVIDER_ENV_CONFIGS[provider].enabled];

  return value === "true";
}
