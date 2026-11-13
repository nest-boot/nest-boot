export const SOCIAL_PROVIDER_ENV_CONFIGS = {
  github: {
    displayName: "GitHub",
    clientId: "AUTH_GITHUB_CLIENT_ID",
    clientSecret: "AUTH_GITHUB_CLIENT_SECRET",
    disableSignUp: "AUTH_GITHUB_DISABLE_SIGN_UP",
    enabled: "AUTH_GITHUB_ENABLED",
    envPrefix: "AUTH_GITHUB_*",
  },
  google: {
    displayName: "Google",
    clientId: "AUTH_GOOGLE_CLIENT_ID",
    clientSecret: "AUTH_GOOGLE_CLIENT_SECRET",
    disableSignUp: "AUTH_GOOGLE_DISABLE_SIGN_UP",
    enabled: "AUTH_GOOGLE_ENABLED",
    envPrefix: "AUTH_GOOGLE_*",
  },
} as const;

export type SocialProviderId = keyof typeof SOCIAL_PROVIDER_ENV_CONFIGS;

export type SocialProviderRequiredEnvKey = "clientId" | "clientSecret";
