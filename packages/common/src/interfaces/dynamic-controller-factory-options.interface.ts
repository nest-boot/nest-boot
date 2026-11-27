import type { FactoryProvider } from "@nestjs/common";

import type { DynamicControllerOptions } from "./dynamic-controller-options.interface.js";

/** Factory configuration used to resolve {@link DynamicControllerOptions} via Nest DI. */
export interface DynamicControllerFactoryOptions<TArgs extends unknown[] = []> {
  /** Optional DI tokens injected into {@link useFactory}. */
  inject?: FactoryProvider["inject"];

  /** Resolves controller path and decorators synchronously or asynchronously. */
  useFactory: (
    ...args: TArgs
  ) => DynamicControllerOptions | Promise<DynamicControllerOptions>;
}
