import { AuthModuleOptions } from "../auth-module-options.interface";
import { hasSocialProviderCredentialEnvConfig } from "./has-social-provider-credential-env-config";
import { isEnvTrue } from "./is-env-true";
import { resolveRequiredSocialProviderEnv } from "./resolve-required-social-provider-env";
import { resolveSocialProviderEnabled } from "./resolve-social-provider-enabled";
import {
  SOCIAL_PROVIDER_ENV_CONFIGS,
  SocialProviderId,
} from "./social-provider.constants";

type SocialProvidersConfig = NonNullable<AuthModuleOptions["socialProviders"]>;
type SocialProviderConfig<T extends SocialProviderId> = NonNullable<
  SocialProvidersConfig[T]
>;

export function createSocialProviderConfig<T extends SocialProviderId>(
  provider: T,
  disableSignUp: boolean,
  options?: SocialProviderConfig<T>,
): SocialProviderConfig<T> | undefined {
  const providerConfig = SOCIAL_PROVIDER_ENV_CONFIGS[provider];
  const hasCredentialEnvConfig = hasSocialProviderCredentialEnvConfig(provider);
  const shouldDisableSignUp =
    disableSignUp || isEnvTrue(providerConfig.disableSignUp);
  const hasEnabledEnv = process.env[providerConfig.enabled] !== undefined;
  const enabled = resolveSocialProviderEnabled(provider);
  const shouldUseCredentialEnv = enabled && hasCredentialEnvConfig;
  const shouldCreateProvider = !!options || enabled;

  if (!shouldCreateProvider) {
    return undefined;
  }

  if (!shouldUseCredentialEnv) {
    if (!options) {
      resolveRequiredSocialProviderEnv(provider, "clientId");
    }

    return {
      ...options,
      ...(hasEnabledEnv ? { enabled } : {}),
      ...(shouldDisableSignUp || options?.disableSignUp === true
        ? { disableSignUp: true }
        : {}),
    } as SocialProviderConfig<T>;
  }

  return {
    ...options,
    clientId: resolveRequiredSocialProviderEnv(provider, "clientId"),
    clientSecret: resolveRequiredSocialProviderEnv(provider, "clientSecret"),
    ...(hasEnabledEnv ? { enabled } : {}),
    disableSignUp: shouldDisableSignUp || options?.disableSignUp === true,
  } as SocialProviderConfig<T>;
}
