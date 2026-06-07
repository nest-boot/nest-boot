import { OidcPrompt } from "./generic-oauth-provider-config.type";

export const OIDC_ENV_NAMES = [
  "AUTH_OIDC_ENABLED",
  "AUTH_OIDC_CLIENT_ID",
  "AUTH_OIDC_CLIENT_SECRET",
  "AUTH_OIDC_DISCOVERY_URL",
  "AUTH_OIDC_DISABLE_SIGNUP",
  "AUTH_OIDC_PROMPT",
  "AUTH_OIDC_SCOPES",
] as const;

export const REQUIRED_OIDC_ENV_NAMES = [
  "AUTH_OIDC_CLIENT_ID",
  "AUTH_OIDC_CLIENT_SECRET",
  "AUTH_OIDC_DISCOVERY_URL",
] as const;

export const OIDC_PROMPTS: readonly OidcPrompt[] = [
  "none",
  "login",
  "create",
  "consent",
  "select_account",
  "select_account consent",
  "login consent",
];

export type RequiredOidcEnvName = (typeof REQUIRED_OIDC_ENV_NAMES)[number];
