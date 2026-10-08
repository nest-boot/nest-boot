import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import { Global, Module, RequestMethod } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthCheckMiddleware } from "./health-check.middleware.js";
import { HealthCheckService } from "./health-check.service.js";
import { HealthCheckRegistry } from "./health-check-registry.service.js";

/** Provides a shared health check registry, service, and GET /api/health middleware. */
@Global()
@Module({
  imports: [TerminusModule, MiddlewareModule],
  providers: [HealthCheckService, HealthCheckRegistry, HealthCheckMiddleware],
  exports: [HealthCheckService, HealthCheckRegistry],
})
export class HealthCheckModule {
  /**
   * Registers the health endpoint through the shared middleware manager.
   * @param middlewareManager - Shared middleware registry
   * @param healthCheckMiddleware - Handler for health requests
   */
  constructor(
    middlewareManager: MiddlewareManager,
    healthCheckMiddleware: HealthCheckMiddleware,
  ) {
    middlewareManager
      .apply(healthCheckMiddleware)
      .forRoutes({ path: "api/health", method: RequestMethod.GET });
  }
}
