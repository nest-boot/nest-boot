import { RequestMethod } from "@nestjs/common";
import type { ApplicationConfig } from "@nestjs/core";

/**
 * Resolves the auth route using the same prefix and exclusions as Nest middleware.
 * @param basePath - Relative authentication route, defaulting to `/auth`
 * @param applicationConfig - Host application's route configuration
 * @returns Effective Better Auth base path
 * @internal
 */
export function resolveAuthBasePath(
  basePath = "/auth",
  applicationConfig?: ApplicationConfig,
): string {
  const routePath = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const path = `/${basePath.replace(/^\/+|\/+$/g, "")}`;
  const prefix = applicationConfig?.getGlobalPrefix().replace(/^\/+|\/+$/g, "");
  const excluded = applicationConfig
    ?.getGlobalPrefixOptions()
    .exclude?.some(
      (route) =>
        route.requestMethod === RequestMethod.ALL &&
        route.pathRegex.test(routePath),
    );
  return prefix && !excluded ? `/${prefix}${path === "/" ? "" : path}` : path;
}
