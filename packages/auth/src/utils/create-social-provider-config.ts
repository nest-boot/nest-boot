import { AuthModuleOptions } from "../auth-module-options.interface";
import { hasSocialProviderCredentialEnvConfig } from "./has-social-provider-credential-env-config";
import { hasSocialProviderEnvConfig } from "./has-social-provider-env-config";
import { isEnvTrue } from "./is-env-true";
import { resolveRequiredSocialProviderEnv } from "./resolve-required-social-provider-env";
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
  const hasEnvConfig = hasSocialProviderEnvConfig(provider);
  const hasCredentialEnvConfig = hasSocialProviderCredentialEnvConfig(provider);
  const shouldDisableSignUp =
    disableSignUp || isEnvTrue(providerConfig.disableSignUp);

  if (!options && !hasEnvConfig) {
    return undefined;
  }

  if (!hasCredentialEnvConfig) {
    if (!options) {
      resolveRequiredSocialProviderEnv(provider, "clientId");
    }

    return {
      ...options,
      ...(shouldDisableSignUp || options?.disableSignUp === true
        ? { disableSignUp: true }
        : {}),
    } as SocialProviderConfig<T>;
  }

  return {
    ...options,
    clientId: resolveRequiredSocialProviderEnv(provider, "clientId"),
    clientSecret: resolveRequiredSocialProviderEnv(provider, "clientSecret"),
    disableSignUp: shouldDisableSignUp || options?.disableSignUp === true,
  } as SocialProviderConfig<T>;
}
