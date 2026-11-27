import { createDynamicController } from "@nest-boot/common";
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

import { MetricsController } from "./metrics.controller.js";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./metrics.module-definition.js";
import { type MetricsModuleOptions } from "./metrics-module-options.interface.js";
import { resolveMetricsOptions } from "./resolve-metrics-options.util.js";

const RegistryProvider: Provider<Registry<RegistryContentType>> = {
  provide: Registry,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options?: MetricsModuleOptions) => {
    const registry = new Registry<RegistryContentType>();
    const collectorOptions = { ...options };
    delete collectorOptions.path;
    delete collectorOptions.decorators;

    collectDefaultMetrics({ ...collectorOptions, register: registry });

    return registry;
  },
};

const metricsController = createDynamicController(MetricsController, {
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options?: MetricsModuleOptions) =>
    resolveMetricsOptions(options),
});

/**
 * Prometheus metrics module.
 *
 * Provides a prom-client Registry with default metrics collection
 * and exposes a dynamic `/metrics` controller for Prometheus scraping.
 */
@Global()
@Module({
  controllers: [metricsController.controller],
  providers: [RegistryProvider, metricsController.provider],
  exports: [RegistryProvider],
})
export class MetricsModule extends ConfigurableModuleClass {
  /**
   * Registers the MetricsModule with the given options.
   * @param options - Collector and endpoint configuration options
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return super.forRoot(options);
  }
}
