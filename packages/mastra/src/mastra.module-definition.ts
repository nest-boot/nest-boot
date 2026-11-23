import type { Config as MastraConfig } from "@mastra/core/mastra";
import { normalizeStudioBase } from "@mastra/deployer/build";
import type { MastraModuleOptions as MastraCoreModuleOptions } from "@mastra/nestjs";
import { ConfigurableModuleBuilder } from "@nestjs/common";

export const DEFAULT_MASTRA_API_PREFIX = "/api/mastra";

export type MastraServerModuleOptions = Omit<
  MastraCoreModuleOptions,
  "mastra" | "tools" | "auth" | "customRouteAuthConfig"
> & {
  /** Authentication belongs to NestJS guards and `@nest-boot/auth`. */
  auth?: never;
  /** Custom routes belong to NestJS controllers. */
  customRouteAuthConfig?: never;
};

export interface MastraApiOptions extends MastraServerModuleOptions {
  /** Whether to register the Mastra HTTP API controller and middleware (default: `true`). */
  enabled?: boolean;
}

export interface MastraStudioOptions {
  /**
   * Whether to mount Mastra Studio at `${prefix}/studio`.
   * Defaults to `true` when `api` is enabled, and `false` when `api` is disabled.
   */
  enabled?: boolean;
  /** Whether to hide Mastra Cloud CTA links in Studio (default: `true`). */
  hideCloudCta?: boolean;
  /** Whether to disable Studio telemetry (default: `true`). */
  telemetryDisabled?: boolean;
}

export type MastraModuleOptions = Omit<MastraConfig, "server" | "studio"> & {
  /** HTTP server configuration belongs to NestJS; supplying `server` is rejected at startup. */
  server?: never;
  /**
   * Configure the Mastra HTTP API routes and server options.
   * - `true` / omitted: enabled under `/api/mastra`
   * - `false`: disables Mastra HTTP API routes (and Studio by default)
   * - object: customizes `enabled`, `prefix`, and `@mastra/nestjs` server options
   */
  api?: boolean | MastraApiOptions;
  /**
   * Configure embedded Mastra Studio hosting at `${prefix}/studio`.
   * - `true` / omitted: enabled whenever `api` is enabled
   * - `false`: disables Mastra Studio
   * - object: customizes `enabled`, `hideCloudCta`, and `telemetryDisabled`
   */
  studio?: boolean | MastraStudioOptions;
};

/**
 * Resolves and normalizes the Mastra HTTP API prefix.
 * @param prefix - Optional configured prefix
 * @returns Normalized API prefix (defaults to `/api/mastra`)
 */
export function resolveMastraApiPrefix(prefix?: string): string {
  return normalizeStudioBase(prefix ?? DEFAULT_MASTRA_API_PREFIX) || "/api";
}

/**
 * Resolves and normalizes the Mastra Studio base path (`${prefix}/studio`).
 * @param prefix - Optional configured Mastra API prefix
 * @returns Normalized Studio base path (defaults to `/api/mastra/studio`)
 */
export function resolveMastraStudioBasePath(prefix?: string): string {
  return normalizeStudioBase(`${resolveMastraApiPrefix(prefix)}/studio`);
}

/**
 * Normalizes the `api` option into an enabled flag and `@mastra/nestjs` server options.
 * @param api - Raw `api` module option
 * @returns Normalized API enabled flag and server options with normalized prefix
 */
export function normalizeMastraApiOptions(api?: MastraModuleOptions["api"]): {
  enabled: boolean;
  serverOptions: MastraServerModuleOptions & { prefix: string };
} {
  if (api === false) {
    return {
      enabled: false,
      serverOptions: {
        prefix: DEFAULT_MASTRA_API_PREFIX,
      },
    };
  }

  const config = typeof api === "object" ? api : {};
  const { enabled = true, prefix, ...rest } = config;

  return {
    enabled,
    serverOptions: {
      ...rest,
      prefix: resolveMastraApiPrefix(prefix),
    },
  };
}

/**
 * Normalizes the `studio` option into concrete boolean flags.
 * @param studio - Raw `studio` module option
 * @param apiEnabled - Whether Mastra HTTP API routes are enabled (default: `true`)
 * @returns Normalized Studio options
 */
export function normalizeMastraStudioOptions(
  studio?: MastraModuleOptions["studio"],
  apiEnabled = true,
): Required<MastraStudioOptions> {
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

  const config = typeof studio === "object" ? studio : {};
  return {
    enabled: config.enabled ?? apiEnabled,
    hideCloudCta: config.hideCloudCta ?? true,
    telemetryDisabled: config.telemetryDisabled ?? true,
  };
}

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: MASTRA_MODULE_OPTIONS,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<MastraModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
