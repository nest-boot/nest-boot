import { AuthModuleOptions } from "../auth-module-options.interface.js";
import { createSocialProviderConfig } from "./create-social-provider-config.js";

type SocialProvidersConfig = NonNullable<AuthModuleOptions["socialProviders"]>;

export function createSocialProvidersConfig(
  disableSignUp: boolean,
  options?: SocialProvidersConfig,
): SocialProvidersConfig | undefined {
  const githubConfig = createSocialProviderConfig(
    "github",
    disableSignUp,
    options?.github,
  );
  const googleConfig = createSocialProviderConfig(
    "google",
    disableSignUp,
    options?.google,
  );

  if (!options && !githubConfig && !googleConfig) {
    return undefined;
  }

  return {
    ...options,
    ...(githubConfig ? { github: githubConfig } : {}),
    ...(googleConfig ? { google: googleConfig } : {}),
  };
}
