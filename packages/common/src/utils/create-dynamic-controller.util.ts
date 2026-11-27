import { type Type } from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";

import type { DynamicController } from "../interfaces/dynamic-controller.interface.js";
import type { DynamicControllerFactoryOptions } from "../interfaces/dynamic-controller-factory-options.interface.js";

const CONTROLLER_WATERMARK = "__controller__";
const PATH_METADATA = "path";
const ENHANCER_METADATA_ENTRIES = [
  ["__guards__", "guard"],
  ["__interceptors__", "interceptor"],
  ["__pipes__", "pipe"],
  ["__exceptionFilters__", "filter"],
] as const;

/**
 * Creates an isolated controller subclass and paired factory provider that applies
 * dynamic `@Controller(path)` and class decorators (including Nest enhancers) during
 * module initialization while preserving base controller host, scope, and version metadata.
 * @param baseController - Base controller class defining the route handlers.
 * @param factoryOptions - DI factory resolving {@link DynamicControllerOptions}.
 * @returns Paired `{ controller, provider }` for registration on a module.
 */
export function createDynamicController<
  TController extends object,
  TArgs extends unknown[] = [],
>(
  baseController: Type<TController>,
  factoryOptions: DynamicControllerFactoryOptions<TArgs>,
): DynamicController<TController> {
  const Base = baseController as Type<object>;
  const controller = class extends Base {} as Type<TController>;
  Object.defineProperty(controller, "name", { value: baseController.name });

  return {
    controller,
    provider: {
      provide: Symbol(`DYNAMIC_CONTROLLER:${baseController.name}`),
      inject: [ModulesContainer, ...(factoryOptions.inject ?? [])],
      useFactory: async (
        modulesContainer: ModulesContainer,
        ...args: TArgs
      ) => {
        const { path, decorators = [] } = await factoryOptions.useFactory(
          ...args,
        );
        if (!Reflect.getMetadata(CONTROLLER_WATERMARK, controller)) {
          Reflect.defineMetadata(CONTROLLER_WATERMARK, true, controller);
        }
        if (path !== undefined) {
          Reflect.defineMetadata(PATH_METADATA, path, controller);
        } else if (
          Reflect.getMetadata(PATH_METADATA, controller) === undefined
        ) {
          Reflect.defineMetadata(PATH_METADATA, "/", controller);
        }

        for (const decorator of decorators) {
          const result = decorator(controller);
          if (result !== undefined && result !== controller) {
            throw new Error(
              "Dynamic controller decorators cannot replace the controller class",
            );
          }
        }

        const hostModule = [...modulesContainer.values()].find((moduleRef) =>
          moduleRef.controllers.has(controller),
        );
        if (hostModule) {
          for (const [metadataKey, subtype] of ENHANCER_METADATA_ENTRIES) {
            const enhancers = Reflect.getMetadata(metadataKey, controller) as
              | unknown[]
              | undefined;
            for (const enhancer of enhancers ?? []) {
              if (typeof enhancer === "function") {
                const enhancerType = enhancer as Type;
                hostModule.addInjectable(enhancerType, subtype, controller);
                const wrapper = hostModule.injectables.get(enhancerType);
                if (wrapper && !wrapper.instance) {
                  wrapper.instance = Object.create(
                    enhancerType.prototype as object,
                  ) as object;
                }
              }
            }
          }
        }
      },
    },
  };
}
