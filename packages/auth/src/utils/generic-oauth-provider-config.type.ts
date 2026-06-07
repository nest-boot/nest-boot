import { type genericOAuth } from "better-auth/plugins";

export type GenericOAuthProviderConfig = Parameters<
  typeof genericOAuth
>[0]["config"][number];

export type OidcPrompt = NonNullable<GenericOAuthProviderConfig["prompt"]>;
