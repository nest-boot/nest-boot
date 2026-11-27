import { Public } from "@nest-boot/common";

import type { HealthCheckModuleOptions } from "./health-check-module-options.interface.js";

export type ResolvedHealthCheckOptions = Required<HealthCheckModuleOptions>;

/**
 * Resolves health check endpoint routing and decorator options with defaults.
 * @param options - Optional user-supplied health check module options.
 * @returns Validated health check controller options.
 */
export function resolveHealthCheckOptions(
  options: HealthCheckModuleOptions = {},
): ResolvedHealthCheckOptions {
  const { path = "/health", decorators = [Public()] } = options;

  if (typeof path !== "string" || !path.trim() || path.trim() !== path) {
    throw new Error("Health check path must be a non-empty trimmed string");
  }
  if (
    !Array.isArray(decorators) ||
    decorators.some((decorator) => typeof decorator !== "function")
  ) {
    throw new Error(
      "Health check decorators must be an array of class decorators",
    );
  }

  return { path, decorators };
}
