import type { MetricsModuleOptions } from "./metrics-module-options.interface.js";

export interface ResolvedMetricsEndpointOptions {
  path: string;
  decorators: ClassDecorator[];
}

/**
 * Resolves metrics endpoint routing and decorator options with defaults.
 * @param options - Optional user-supplied metrics module options.
 * @returns Validated metrics controller options.
 */
export function resolveMetricsOptions(
  options: Pick<MetricsModuleOptions, "path" | "decorators"> = {},
): ResolvedMetricsEndpointOptions {
  const { path = "/metrics", decorators = [] } = options;

  if (typeof path !== "string" || !path.trim() || path.trim() !== path) {
    throw new Error("Metrics path must be a non-empty trimmed string");
  }
  if (
    !Array.isArray(decorators) ||
    decorators.some((decorator) => typeof decorator !== "function")
  ) {
    throw new Error("Metrics decorators must be an array of class decorators");
  }

  return { path, decorators };
}
