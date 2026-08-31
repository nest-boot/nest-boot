import {
  GenericOAuthProviderConfig,
  OidcPrompt,
} from "./generic-oauth-provider-config.type.js";
import { OIDC_PROMPTS } from "./oidc.constants.js";

export function resolveOidcPrompt(): GenericOAuthProviderConfig["prompt"] {
  const prompt = process.env.AUTH_OIDC_PROMPT;

  if (!prompt) {
    return undefined;
  }

  if (!OIDC_PROMPTS.includes(prompt as OidcPrompt)) {
    throw new Error(
      "AUTH_OIDC_PROMPT is invalid.\n" +
        `Set AUTH_OIDC_PROMPT to one of: ${OIDC_PROMPTS.join(", ")}.`,
    );
  }

  return prompt as OidcPrompt;
}
