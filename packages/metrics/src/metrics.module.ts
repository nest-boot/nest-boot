import { Module, type Provider } from "@nestjs/common";
import { collectDefaultMetrics, Registry } from "prom-client";

import { MetricsController } from "./metrics.controller";
import { ConfigurableModuleClass } from "./metrics.module-definition";

const RegistryProvider: Provider<Registry> = {
  provide: Registry,
  useFactory: () => {
    const registry = new Registry();

    collectDefaultMetrics({ register: registry });

    return registry;
  },
};

/**
 * Module for exposing Prometheus metrics using prom-client.
 * It registers a controller at `/metrics` and collects default metrics.
 */
@Module({
  controllers: [MetricsController],
  providers: [RegistryProvider],
  exports: [RegistryProvider],
})
export class MetricsModule extends ConfigurableModuleClass {}
