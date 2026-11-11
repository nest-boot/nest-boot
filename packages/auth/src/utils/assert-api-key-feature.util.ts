import { ForbiddenException } from "@nestjs/common";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { resolveAuthFeatures } from "./resolve-auth-features.util.js";

/**
 * Rejects programmatic access to disabled credential scopes before persistence.
 * @param options - Authentication configuration.
 * @param scope - Required credential feature.
 */
export function assertApiKeyFeature(
  options: AuthModuleOptions,
  scope: "userApiKey" | "workspaceApiKey" | "systemAccountApiKey",
): void {
  if (!resolveAuthFeatures(options)[scope]) {
    throw new ForbiddenException("This API-key scope is disabled");
  }
}
