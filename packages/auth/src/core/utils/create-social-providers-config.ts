import type { BetterAuthOptions } from "better-auth";

import { createSocialProviderConfig } from "./create-social-provider-config.js";

type SocialProvidersConfig = NonNullable<BetterAuthOptions["socialProviders"]>;

/**
 * Returns enabled social provider configurations.
 * @param disableSignUp - Whether provider-based registration is disabled.
 * @param options - Configuration for this operation.
 * @returns Enabled social provider configurations.
 */
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
