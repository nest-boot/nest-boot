import {
  Controller,
  Get,
  Res,
  SetMetadata,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { HealthCheckResult } from "@nestjs/terminus";

import { HealthCheckService } from "./health-check.service.js";

const CACHE_KEY_METADATA = "cache_module:cache_key";

/** Exposes the application's aggregated health check endpoint. */
@Controller({ path: "/health", version: VERSION_NEUTRAL })
export class HealthCheckController {
  /**
   * Creates the health check controller.
   * @param healthCheckService - Service that executes the registered indicators
   * @param httpAdapterHost - Active HTTP adapter used to set response headers
   */
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  /**
   * Executes registered health checks and returns Terminus's aggregated result.
   * @param response - Response managed by the active HTTP adapter
   * @returns Aggregated Terminus health check result
   */
  @Get()
  // Bypass @nestjs/cache-manager global CacheInterceptor so every probe runs live.
  @SetMetadata(CACHE_KEY_METADATA, () => undefined)
  async check(
    @Res({ passthrough: true }) response: unknown,
  ): Promise<HealthCheckResult> {
    this.httpAdapterHost.httpAdapter.setHeader(
      response,
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );

    return await this.healthCheckService.check();
  }
}
