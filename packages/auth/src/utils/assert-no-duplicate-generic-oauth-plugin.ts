import { BetterAuthPlugin } from "better-auth";

export function assertNoDuplicateGenericOAuthPlugin(
  plugins?: BetterAuthPlugin[],
): void {
  if (!plugins?.some((plugin) => plugin.id === "generic-oauth")) {
    return;
  }

  throw new Error(
    "AUTH_OIDC_* cannot be used together with a manually configured genericOAuth plugin.\n" +
      "Configure all generic OAuth providers in plugins, or remove the custom genericOAuth plugin and use AUTH_OIDC_* only.",
  );
}
