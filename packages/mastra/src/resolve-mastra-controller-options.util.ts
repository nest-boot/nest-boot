import { Mastra } from "@mastra/core/mastra";
import { Can } from "@nest-boot/auth";
import type { DynamicControllerOptions } from "@nest-boot/common";

import {
  type MastraModuleOptions,
  normalizeMastraServerOptions,
} from "./mastra.module-definition.js";

/**
 * Resolves route path and class decorators for the dynamic `MastraController`.
 * Defaults to `@Can("manage", Mastra)`, enforced by the host app's `AuthModule` (`APP_GUARD`)
 * or replaceable via `server.decorators` in apps using custom NestJS guards without `AuthModule`.
 * @param server - Raw `server` module option.
 * @returns Validated dynamic controller options with `[Can("manage", Mastra)]` default.
 */
export function resolveMastraControllerOptions(
  server?: MastraModuleOptions["server"],
): Required<DynamicControllerOptions> {
  const { enabled, serverOptions } = normalizeMastraServerOptions(server);
  const decorators =
    typeof server === "object" && server?.decorators !== undefined
      ? server.decorators
      : [Can("manage", Mastra)];

  if (
    !Array.isArray(decorators) ||
    decorators.some((decorator) => typeof decorator !== "function")
  ) {
    throw new Error(
      "Mastra server.decorators must be an array of class decorators",
    );
  }

  return {
    enabled,
    path: serverOptions.prefix,
    decorators,
  };
}
