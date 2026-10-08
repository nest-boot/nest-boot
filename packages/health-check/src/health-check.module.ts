import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import { Global, Module, RequestMethod } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthCheckMiddleware } from "./health-check.middleware.js";
import { HealthCheckService } from "./health-check.service.js";
import { HealthCheckRegistry } from "./health-check-registry.service.js";

/** Provides a shared health check registry, service, and public GET /api/health middleware. */
@Global()
@Module({
  imports: [TerminusModule, MiddlewareModule],
  providers: [HealthCheckService, HealthCheckRegistry, HealthCheckMiddleware],
  exports: [HealthCheckService, HealthCheckRegistry],
})
export class HealthCheckModule {
  /**
   * Registers the health endpoint independently of managed business middleware.
   * @param middlewareManager - Shared middleware registry
   * @param healthCheckMiddleware - Handler for health requests
   */
  constructor(
    middlewareManager: MiddlewareManager,
    healthCheckMiddleware: HealthCheckMiddleware,
  ) {
    const route = { path: "api/health", method: RequestMethod.GET };
    middlewareManager.globalExclude(route);
    middlewareManager
      .apply(healthCheckMiddleware)
      .disableGlobalExcludeRoutes()
      .forRoutes(route);
  }
}
