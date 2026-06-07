import { AuthModuleOptions } from "../auth-module-options.interface";
import { estimateEntropy } from "./estimate-entropy";

export function resolveSecret(options: AuthModuleOptions): string {
  const secret =
    options.secret ?? process.env.AUTH_SECRET ?? process.env.APP_SECRET;

  if (!secret) {
    throw new Error(
      "Auth secret is required.\n" +
        "Set AUTH_SECRET or APP_SECRET environment variable, or pass a secret option.\n" +
        "Generate a secure secret with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }

  if (secret.length < 32) {
    throw new Error(
      "Auth secret must be at least 32 characters long.\n" +
        "Set AUTH_SECRET or APP_SECRET environment variable, or pass a secret option.\n" +
        "Generate a secure secret with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }

  if (estimateEntropy(secret) < 120) {
    throw new Error(
      "Auth secret appears low-entropy.\n" +
        "Use a randomly generated secret for production.\n" +
        "Generate a secure secret with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }

  return secret;
}
