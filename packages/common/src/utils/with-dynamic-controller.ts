import type { DynamicModule, Type } from "@nestjs/common";

import type { DynamicControllerFactoryOptions } from "../interfaces/dynamic-controller-factory-options.interface.js";
import { createDynamicController } from "./create-dynamic-controller.js";

/**
 * Returns a new {@link DynamicModule} with an isolated dynamic controller and its
 * configuration provider attached.
 * @param dynamicModule - Base dynamic module (such as `super.forRoot(...)` or `super.forRootAsync(...)`).
 * @param baseController - Base controller class defining the route handlers.
 * @param factoryOptions - DI factory resolving {@link DynamicControllerOptions}.
 * @returns Enhanced dynamic module.
 */
export function withDynamicController<
  TController extends object,
  TArgs extends unknown[] = [],
>(
  dynamicModule: DynamicModule,
  baseController: Type<TController>,
  factoryOptions: DynamicControllerFactoryOptions<TArgs>,
): DynamicModule {
  const { controller, provider } = createDynamicController(
    baseController,
    factoryOptions,
  );

  return {
    ...dynamicModule,
    controllers: [...(dynamicModule.controllers ?? []), controller],
    providers: [...(dynamicModule.providers ?? []), provider],
  };
}
