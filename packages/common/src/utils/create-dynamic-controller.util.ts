import {
  type FactoryProvider,
  Scope,
  type ScopeOptions,
  type Type,
} from "@nestjs/common";
import { LazyModuleLoader, ModuleRef, ModulesContainer } from "@nestjs/core";
import { DiscoverableMetaHostCollection } from "@nestjs/core/discovery/discoverable-meta-host-collection.js";
import { registerClassRef } from "@nestjs/core/helpers/class-ref-registry.js";

import type { DynamicController } from "../interfaces/dynamic-controller.interface.js";
import type { DynamicControllerFactoryOptions } from "../interfaces/dynamic-controller-factory-options.interface.js";

type ContainerModule =
  ModulesContainer extends Map<string, infer TModule> ? TModule : never;
type ControllerWrapper =
  ContainerModule["controllers"] extends Map<unknown, infer TWrapper>
    ? TWrapper
    : never;
type EnhancerWrapper = ReturnType<
  ControllerWrapper["getEnhancersMetadata"]
>[number];

interface EnhancerCacheEntry {
  moduleToken: string;
  classRef: unknown;
  enhancerInstanceWrapper?: EnhancerWrapper;
  targetNodeId?: string;
  enhancerRef?: unknown;
  methodKey?: string;
  subtype: "guard" | "interceptor" | "pipe" | "filter";
}

interface GraphInspectorLike {
  enhancersMetadataCache?: EnhancerCacheEntry[];
  insertEnhancerMetadataCache?: (entry: EnhancerCacheEntry) => void;
}

const CONTROLLER_WATERMARK = "__controller__";
const HOST_METADATA = "host";
const PATH_METADATA = "path";
const SCOPE_OPTIONS_METADATA = "scope:options";
const VERSION_METADATA = "__version__";
const ENHANCER_METADATA_ENTRIES = [
  ["__guards__", "guard"],
  ["__interceptors__", "interceptor"],
  ["__pipes__", "pipe"],
  ["__exceptionFilters__", "filter"],
] as const;

/**
 * Resolves the active `GraphInspector` instance from Nest's `LazyModuleLoader` when
 * graph inspection (`snapshot: true`) is enabled.
 * @param lazyModuleLoader - Container lazy module loader
 * @returns Graph inspector instance, if present
 */
function resolveGraphInspector(
  lazyModuleLoader: LazyModuleLoader,
): GraphInspectorLike | undefined {
  return (
    lazyModuleLoader as unknown as {
      instanceLoader?: { graphInspector?: GraphInspectorLike };
    }
  ).instanceLoader?.graphInspector;
}

/**
 * Clears any prematurely initialized `InstanceLinksHost` caches across module `ModuleRef`
 * providers so post-bootstrap `ModuleRef.get()` sees replaced or removed controllers.
 * @param modulesContainer - Active Nest modules container
 */
function invalidateModuleRefCaches(modulesContainer: ModulesContainer): void {
  for (const candidate of modulesContainer.values()) {
    const ref = candidate.providers.get(ModuleRef)?.instance as
      | { _instanceLinksHost?: unknown }
      | undefined;
    if (ref) {
      delete ref._instanceLinksHost;
    }
  }
}

/**
 * Creates an isolated controller subclass and paired factory provider that mounts
 * a per-container runtime subclass with dynamic `@Controller(path)` and class
 * decorators (including Nest enhancers) during module initialization while preserving
 * base controller, caller-attached, and request-scoped enhancer metadata.
 * Both `controller` and `provider` must be registered on the same `@Module()`.
 * @param baseController - Base controller class defining the route handlers.
 * @param factoryOptions - DI factory resolving {@link DynamicControllerOptions}.
 * @returns Paired `{ controller, provider }` for registration on the same module.
 */
export function createDynamicController<
  TController extends object,
  TArgs extends unknown[] = [],
>(
  baseController: Type<TController>,
  factoryOptions: DynamicControllerFactoryOptions<TArgs>,
): DynamicController<TController> {
  const Base = baseController as new (...args: unknown[]) => object;
  const controller = class extends Base {
    constructor(...ctorArgs: unknown[]) {
      if (new.target === controller) {
        throw new Error(
          `Dynamic controller "${baseController.name}" was not initialized; ensure its provider is registered on the same module and only injects static providers`,
        );
      }
      super(...ctorArgs);
    }
  } as Type<TController>;
  Object.defineProperty(controller, "name", { value: baseController.name });
  // Keep valid controller metadata on the placeholder so Nest `preview: true` mode
  // (which skips provider factories and controller constructors) can still resolve
  // routes during `app.init()`, while `new.target === controller` above fails closed
  // whenever the factory is skipped in normal mode.
  Reflect.defineMetadata(CONTROLLER_WATERMARK, true, controller);
  if (!Reflect.hasMetadata(PATH_METADATA, Base)) {
    Reflect.defineMetadata(PATH_METADATA, "/", controller);
  }

  const provider: FactoryProvider<Type<TController> | undefined> = {
    provide: Symbol(`DYNAMIC_CONTROLLER:${baseController.name}`),
    inject: [
      ModulesContainer,
      ModuleRef,
      LazyModuleLoader,
      ...(factoryOptions.inject ?? []),
    ],
    useFactory: async (
      modulesContainer: ModulesContainer,
      moduleRef: ModuleRef,
      lazyModuleLoader: LazyModuleLoader,
      ...args: TArgs
    ): Promise<Type<TController> | undefined> => {
      // Co-locating `controller` and `provider` on the same module guarantees Nest's
      // `InstanceLoader` awaits `provider` before instantiating that module's
      // injectables (guards/interceptors/pipes/filters) and controllers.
      const hostModule = [...modulesContainer.values()].find(
        (candidate) =>
          candidate.providers.get(ModuleRef)?.instance === moduleRef,
      );
      const originalWrapper = hostModule?.controllers.get(controller);
      if (!hostModule || !originalWrapper) {
        throw new Error(
          `Dynamic controller "${baseController.name}" and its provider must be registered on the same module`,
        );
      }

      const graphInspector = resolveGraphInspector(lazyModuleLoader);
      const rawEnhancerCache: unknown = graphInspector?.enhancersMetadataCache;
      const enhancerCache = Array.isArray(rawEnhancerCache)
        ? (rawEnhancerCache as EnhancerCacheEntry[])
        : undefined;
      const {
        enabled = true,
        path,
        decorators = [],
      } = await factoryOptions.useFactory(...args);

      if (!enabled) {
        const controllerEnhancers =
          (originalWrapper.getEnhancersMetadata() as
            | EnhancerWrapper[]
            | undefined) ?? [];
        originalWrapper.detachFromDependencies();
        DiscoverableMetaHostCollection.removeInstanceWrappers(
          modulesContainer,
          [originalWrapper],
        );
        hostModule.controllers.delete(controller);
        if (enhancerCache) {
          for (let i = enhancerCache.length - 1; i >= 0; i -= 1) {
            const entry = enhancerCache[i];
            if (
              entry?.moduleToken === hostModule.token &&
              entry.classRef === controller
            ) {
              enhancerCache.splice(i, 1);
            }
          }
        }
        invalidateModuleRefCaches(modulesContainer);

        const retainedEnhancers = new Set<EnhancerWrapper>();
        for (const remaining of [
          ...hostModule.controllers.values(),
          ...hostModule.providers.values(),
        ]) {
          const enhancers = remaining.getEnhancersMetadata() as
            | EnhancerWrapper[]
            | undefined;
          for (const enhancer of enhancers ?? []) {
            retainedEnhancers.add(enhancer);
          }
        }
        for (const enhancer of controllerEnhancers) {
          if (
            !retainedEnhancers.has(enhancer) &&
            typeof enhancer.token === "function"
          ) {
            hostModule.injectables.delete(enhancer.token);
          }
        }
        return undefined;
      }

      // Intentionally leave `controller` unmutated as a compile-time registration
      // placeholder so shared dynamic modules never leak paths or decorators across
      // containers; callers needing the mounted class inject `provider.provide`.
      const runtimeController =
        class extends (controller as Type<object>) {} as Type<TController>;
      Object.defineProperty(runtimeController, "name", {
        value: baseController.name,
      });
      Reflect.defineMetadata(CONTROLLER_WATERMARK, true, runtimeController);
      const inheritedPath = Reflect.getMetadata(PATH_METADATA, controller) as
        | string
        | string[]
        | undefined;
      Reflect.defineMetadata(
        PATH_METADATA,
        path ?? inheritedPath ?? "/",
        runtimeController,
      );

      try {
        for (const decorator of decorators) {
          const result = decorator(runtimeController);
          if (result !== undefined && result !== runtimeController) {
            throw new Error(
              "Dynamic controller decorators cannot replace the controller class",
            );
          }
        }
        // Nest's `@Controller()` unconditionally writes `PATH_METADATA` (defaulting to `/`),
        // `HOST_METADATA`, `VERSION_METADATA`, and `SCOPE_OPTIONS_METADATA` (even when `undefined`).
        // Re-apply an explicit `options.path` and strip `undefined` own shadows so decorators
        // like `@Controller({ host })` do not clobber configured paths or inherited metadata.
        if (path !== undefined) {
          Reflect.defineMetadata(PATH_METADATA, path, runtimeController);
        }
        for (const key of [HOST_METADATA, VERSION_METADATA]) {
          if (
            Reflect.hasOwnMetadata(key, runtimeController) &&
            Reflect.getOwnMetadata(key, runtimeController) === undefined
          ) {
            Reflect.deleteMetadata(key, runtimeController);
          }
        }
        if (Reflect.hasOwnMetadata(SCOPE_OPTIONS_METADATA, runtimeController)) {
          const ownScope = Reflect.getOwnMetadata(
            SCOPE_OPTIONS_METADATA,
            runtimeController,
          ) as ScopeOptions | undefined;
          if (
            ownScope === undefined ||
            (ownScope.scope === undefined && ownScope.durable === undefined)
          ) {
            Reflect.deleteMetadata(SCOPE_OPTIONS_METADATA, runtimeController);
          } else {
            const inheritedScope = Reflect.getMetadata(
              SCOPE_OPTIONS_METADATA,
              controller,
            ) as ScopeOptions | undefined;
            Reflect.defineMetadata(
              SCOPE_OPTIONS_METADATA,
              {
                scope: ownScope.scope ?? inheritedScope?.scope,
                durable: ownScope.durable ?? inheritedScope?.durable,
              },
              runtimeController,
            );
          }
        }

        const expectedScope = originalWrapper.scope ?? Scope.DEFAULT;
        const expectedDurable = originalWrapper.durable ?? false;
        const runtimeScopeOptions = Reflect.getMetadata(
          SCOPE_OPTIONS_METADATA,
          runtimeController,
        ) as ScopeOptions | undefined;
        const effectiveScope = runtimeScopeOptions?.scope ?? Scope.DEFAULT;
        const effectiveDurable = runtimeScopeOptions?.durable ?? false;
        if (
          effectiveScope !== expectedScope ||
          effectiveDurable !== expectedDurable
        ) {
          throw new Error(
            "Dynamic controller decorators cannot change controller scope or durability; declare scope on the base @Controller() instead",
          );
        }

        DiscoverableMetaHostCollection.removeInstanceWrappers(
          modulesContainer,
          [originalWrapper],
        );

        // Reuse `originalWrapper` in place to preserve its pre-allocated wrapper ID,
        // compile-time scope, and pre-attached enhancer links.
        (originalWrapper as { token: unknown }).token = runtimeController;
        originalWrapper.metatype = runtimeController;
        if (originalWrapper.instance) {
          Object.setPrototypeOf(
            originalWrapper.instance,
            runtimeController.prototype as object,
          );
        } else {
          originalWrapper.instance = Object.create(
            runtimeController.prototype as object,
          ) as TController;
        }
        registerClassRef(runtimeController);
        hostModule.assignControllerUniqueId(runtimeController);

        const orderedEntries = [...hostModule.controllers.entries()];
        hostModule.controllers.clear();
        for (const [token, wrapper] of orderedEntries) {
          hostModule.controllers.set(
            token === controller ? runtimeController : token,
            wrapper,
          );
        }

        for (const entry of enhancerCache ?? []) {
          if (
            entry.moduleToken === hostModule.token &&
            entry.classRef === controller
          ) {
            entry.classRef = runtimeController;
          }
        }

        // NestJS >=12.6 `DiscoverableMetaHostCollection.getMetaKeysByInstanceWrapper`
        // walks the prototype chain (`runtimeController -> controller -> Base`), so
        // inspecting `originalWrapper` indexes base, caller, and runtime tags together.
        DiscoverableMetaHostCollection.inspectController(
          modulesContainer,
          originalWrapper,
        );

        const attachedEnhancers = new Set<EnhancerWrapper>(
          (originalWrapper.getEnhancersMetadata() as
            | EnhancerWrapper[]
            | undefined) ?? [],
        );
        for (const [metadataKey, subtype] of ENHANCER_METADATA_ENTRIES) {
          const enhancers = Reflect.getMetadata(
            metadataKey,
            runtimeController,
          ) as unknown[] | undefined;
          for (const enhancer of enhancers ?? []) {
            if (typeof enhancer === "function") {
              const enhancerType = enhancer as Type;
              const existingWrapper = hostModule.injectables.get(enhancerType);
              if (!existingWrapper || !attachedEnhancers.has(existingWrapper)) {
                hostModule.addInjectable(
                  enhancerType,
                  subtype,
                  runtimeController,
                );
                const wrapper = hostModule.injectables.get(enhancerType);
                if (wrapper) {
                  attachedEnhancers.add(wrapper);
                  wrapper.instance ??= Object.create(
                    enhancerType.prototype as object,
                  ) as object;
                  if (enhancerCache) {
                    graphInspector?.insertEnhancerMetadataCache?.({
                      moduleToken: hostModule.token,
                      classRef: runtimeController,
                      enhancerInstanceWrapper: wrapper,
                      targetNodeId: wrapper.id,
                      subtype,
                    });
                  }
                }
              }
            }
          }
        }
        invalidateModuleRefCaches(modulesContainer);
      } finally {
        DiscoverableMetaHostCollection.metaHostLinks.delete(runtimeController);
      }

      return runtimeController;
    },
  };

  return {
    controller,
    provider,
  };
}
