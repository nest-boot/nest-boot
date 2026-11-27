import { createDynamicController } from "@nest-boot/common";
import { type DynamicModule, Global, Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthCheckController } from "./health-check.controller.js";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./health-check.module-definition.js";
import { HealthCheckService } from "./health-check.service.js";
import type { HealthCheckModuleOptions } from "./health-check-module-options.interface.js";
import { HealthCheckRegistry } from "./health-check-registry.service.js";
import { resolveHealthCheckOptions } from "./resolve-health-check-options.util.js";

const healthCheckController = createDynamicController(HealthCheckController, {
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options?: HealthCheckModuleOptions) =>
    resolveHealthCheckOptions(options),
});

/**
 * Provides a shared health check registry, service, and dynamic `GET /health`
 * controller marked with `@Public()` by default.
 */
@Global()
@Module({
  imports: [TerminusModule],
  controllers: [healthCheckController.controller],
  providers: [
    HealthCheckService,
    HealthCheckRegistry,
    healthCheckController.provider,
  ],
  exports: [HealthCheckService, HealthCheckRegistry],
})
export class HealthCheckModule extends ConfigurableModuleClass {
  /**
   * Registers `HealthCheckModule` with custom route or controller decorators.
   * @param options - Optional health endpoint path and class decorators
   * @returns Dynamic health check module
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return super.forRoot(options);
  }
}
