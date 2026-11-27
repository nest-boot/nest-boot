import type { FactoryProvider, Type } from "@nestjs/common";

/**
 * Paired isolated controller subclass and its configuration provider.
 * Both `controller` and `provider` must be registered on the same `@Module()`.
 */
export interface DynamicController<TController = unknown> {
  /**
   * Placeholder subclass registered in `@Module({ controllers: [controller] })`.
   * Left unmutated at runtime so shared dynamic modules stay isolated across containers;
   * inject `provider.provide` when passing the mounted controller to `MiddlewareConsumer.forRoutes()`.
   */
  controller: Type<TController>;

  /** Factory provider registered on the same `@Module()` that resolves the container-local controller subclass (or `undefined` when disabled) before route discovery. */
  provider: FactoryProvider<Type<TController> | undefined>;
}
