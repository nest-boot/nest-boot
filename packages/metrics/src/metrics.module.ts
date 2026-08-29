import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from "@nestjs/common";
import {
  collectDefaultMetrics,
  Registry,
  type RegistryContentType,
} from "prom-client";

import { MetricsController } from "./metrics.controller";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./metrics.module-definition";
import { type MetricsModuleOptions } from "./metrics-module-options.interface";

const RegistryProvider: Provider<Registry> = {
  provide: Registry,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options?: MetricsModuleOptions<RegistryContentType>) => {
    const registry = new Registry();

    collectDefaultMetrics({ ...options, register: registry });

    return registry;
  },
};

/**
 * Prometheus metrics module.
 *
 * @remarks
 * Provides a prom-client Registry with default metrics collection
 * and exposes a `/metrics` endpoint for Prometheus scraping.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [RegistryProvider],
  exports: [RegistryProvider],
})
export class MetricsModule extends ConfigurableModuleClass {
  /**
   * Registers the MetricsModule with the given options.
   * @param options - Configuration options
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the MetricsModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }
}
