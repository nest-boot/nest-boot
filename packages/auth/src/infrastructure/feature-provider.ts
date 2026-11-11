import type { FactoryProvider, Type } from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { resolveAuthFeatures } from "../utils/resolve-auth-features.util.js";

/**
 * Registers an injectable token while omitting disabled resolver instances from schema discovery.
 * @param token - Service or resolver token.
 * @param feature - Required feature.
 * @param inject - Factory dependencies after authentication options.
 * @param factory - Constructor for the enabled implementation.
 * @returns Conditional Nest provider, compatible with synchronous and asynchronous options.
 * @internal
 */
export function featureProvider<Instance, Args extends unknown[]>(
  token: Type<Instance>,
  feature: keyof ReturnType<typeof resolveAuthFeatures>,
  inject: NonNullable<FactoryProvider["inject"]>,
  factory: (options: AuthModuleOptions, ...args: Args) => Instance,
): FactoryProvider<Instance | null> & {
  useFactory: (options: AuthModuleOptions, ...args: Args) => Instance | null;
} {
  return {
    provide: token,
    inject: [MODULE_OPTIONS_TOKEN, ...inject],
    useFactory: (options: AuthModuleOptions, ...args: Args) =>
      resolveAuthFeatures(options)[feature] ? factory(options, ...args) : null,
  };
}
