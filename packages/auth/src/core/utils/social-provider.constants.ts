export const SOCIAL_PROVIDER_ENV_CONFIGS = {
  github: {
    displayName: "GitHub",
    clientId: "AUTH_GITHUB_CLIENT_ID",
    clientSecret: "AUTH_GITHUB_CLIENT_SECRET",
    disableSignUp: "AUTH_GITHUB_DISABLE_SIGN_UP",
    enabled: "AUTH_GITHUB_ENABLED",
    envPrefix: "AUTH_GITHUB_*",
    envNames: [
      "AUTH_GITHUB_CLIENT_ID",
      "AUTH_GITHUB_CLIENT_SECRET",
      "AUTH_GITHUB_DISABLE_SIGN_UP",
      "AUTH_GITHUB_ENABLED",
    ],
  },
  google: {
    displayName: "Google",
    clientId: "AUTH_GOOGLE_CLIENT_ID",
    clientSecret: "AUTH_GOOGLE_CLIENT_SECRET",
    disableSignUp: "AUTH_GOOGLE_DISABLE_SIGN_UP",
    enabled: "AUTH_GOOGLE_ENABLED",
    envPrefix: "AUTH_GOOGLE_*",
    envNames: [
      "AUTH_GOOGLE_CLIENT_ID",
      "AUTH_GOOGLE_CLIENT_SECRET",
      "AUTH_GOOGLE_DISABLE_SIGN_UP",
      "AUTH_GOOGLE_ENABLED",
    ],
  },
} as const;

export type SocialProviderId = keyof typeof SOCIAL_PROVIDER_ENV_CONFIGS;

export type SocialProviderRequiredEnvKey = "clientId" | "clientSecret";
