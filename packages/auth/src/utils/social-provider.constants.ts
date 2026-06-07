export const SOCIAL_PROVIDER_ENV_CONFIGS = {
  github: {
    displayName: "GitHub",
    clientId: "AUTH_GITHUB_CLIENT_ID",
    clientSecret: "AUTH_GITHUB_CLIENT_SECRET",
    disableSignUp: "AUTH_GITHUB_DISABLE_SIGNUP",
    envPrefix: "AUTH_GITHUB_*",
    envNames: [
      "AUTH_GITHUB_CLIENT_ID",
      "AUTH_GITHUB_CLIENT_SECRET",
      "AUTH_GITHUB_DISABLE_SIGNUP",
    ],
  },
  google: {
    displayName: "Google",
    clientId: "AUTH_GOOGLE_CLIENT_ID",
    clientSecret: "AUTH_GOOGLE_CLIENT_SECRET",
    disableSignUp: "AUTH_GOOGLE_DISABLE_SIGNUP",
    envPrefix: "AUTH_GOOGLE_*",
    envNames: [
      "AUTH_GOOGLE_CLIENT_ID",
      "AUTH_GOOGLE_CLIENT_SECRET",
      "AUTH_GOOGLE_DISABLE_SIGNUP",
    ],
  },
} as const;

export type SocialProviderId = keyof typeof SOCIAL_PROVIDER_ENV_CONFIGS;

export type SocialProviderRequiredEnvKey = "clientId" | "clientSecret";
