import { normalizeStudioBase } from "@mastra/deployer/build";

import type { MastraModuleOptions } from "../interfaces/mastra-module-options.interface.js";
import type {
  MastraServerModuleOptions,
  MastraServerOptions,
} from "../interfaces/mastra-server-options.interface.js";
import type { MastraStudioOptions } from "../interfaces/mastra-studio-options.interface.js";
import { DEFAULT_MASTRA_SERVER_PREFIX } from "../mastra.constants.js";

/**
 * Checks whether a value is a non-null, non-array plain object record.
 * @param value - Candidate value to inspect
 * @returns `true` when `value` is a non-null, non-array object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolves and normalizes the Mastra HTTP server route prefix.
 * @param prefix - Optional configured prefix
 * @returns Normalized server prefix (defaults to `/api/mastra`)
 */
export function resolveMastraServerPrefix(prefix?: string): string {
  if (prefix !== undefined && typeof prefix !== "string") {
    throw new Error("Mastra server.prefix must be a string");
  }
  return normalizeStudioBase(prefix ?? DEFAULT_MASTRA_SERVER_PREFIX) || "/api";
}

/**
 * Resolves and normalizes the Mastra Studio base path (`${prefix}/studio`).
 * @param prefix - Optional configured Mastra server prefix
 * @returns Normalized Studio base path (defaults to `/api/mastra/studio`)
 */
export function resolveMastraStudioBasePath(prefix?: string): string {
  return normalizeStudioBase(`${resolveMastraServerPrefix(prefix)}/studio`);
}

/**
 * Normalizes the `server` option into an enabled flag and `@mastra/nestjs` server options.
 * @param server - Raw `server` module option
 * @returns Normalized server enabled flag and server options with normalized `prefix`
 */
export function normalizeMastraServerOptions(
  server?: MastraModuleOptions["server"],
): {
  enabled: boolean;
  serverOptions: MastraServerModuleOptions & { prefix: string };
} {
  if (server === undefined || server === false) {
    return {
      enabled: false,
      serverOptions: {
        prefix: DEFAULT_MASTRA_SERVER_PREFIX,
      },
    };
  }

  if (server !== true && !isPlainObject(server)) {
    throw new Error(
      "Mastra server option must be a boolean or an options object",
    );
  }

  const config: MastraServerOptions = server === true ? {} : server;
  if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
    throw new Error("Mastra server.enabled must be a boolean");
  }
  const { enabled = true, prefix } = config;
  const rest = { ...config };
  delete rest.enabled;
  delete rest.prefix;
  delete rest.decorators;

  return {
    enabled,
    serverOptions: {
      ...rest,
      prefix: resolveMastraServerPrefix(prefix),
    },
  };
}

/**
 * Normalizes the `studio` option into concrete boolean flags.
 * @param studio - Raw `studio` module option
 * @param serverEnabled - Whether Mastra HTTP server routes are enabled (default: `false`)
 * @returns Normalized Studio options
 */
export function normalizeMastraStudioOptions(
  studio?: MastraModuleOptions["studio"],
  serverEnabled = false,
): Required<MastraStudioOptions> {
  if (
    studio !== undefined &&
    typeof studio !== "boolean" &&
    !isPlainObject(studio)
  ) {
    throw new Error(
      "Mastra studio option must be a boolean or an options object",
    );
  }

  if (studio === false) {
    return {
      enabled: false,
      hideCloudCta: true,
      telemetryDisabled: true,
    };
  }

  if (studio === true) {
    return {
      enabled: true,
      hideCloudCta: true,
      telemetryDisabled: true,
    };
  }

  const config: MastraStudioOptions = studio ?? {};
  if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
    throw new Error("Mastra studio.enabled must be a boolean");
  }
  if (
    config.hideCloudCta !== undefined &&
    typeof config.hideCloudCta !== "boolean"
  ) {
    throw new Error("Mastra studio.hideCloudCta must be a boolean");
  }
  if (
    config.telemetryDisabled !== undefined &&
    typeof config.telemetryDisabled !== "boolean"
  ) {
    throw new Error("Mastra studio.telemetryDisabled must be a boolean");
  }

  return {
    enabled: config.enabled ?? serverEnabled,
    hideCloudCta: config.hideCloudCta ?? true,
    telemetryDisabled: config.telemetryDisabled ?? true,
  };
}
