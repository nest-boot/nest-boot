import { Injectable, type NestMiddleware } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

import { HealthCheckService } from "./health-check.service.js";

/** Responds to health requests before the controller and guard pipeline. */
@Injectable()
export class HealthCheckMiddleware implements NestMiddleware {
  /**
   * Creates the health check middleware.
   * @param healthCheckService - Service that executes the registered indicators
   * @param httpAdapterHost - Active HTTP adapter used to write the response
   */
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  /**
   * Responds with the aggregated result; Nest handles failed check exceptions.
   * @param _request - Incoming health request
   * @param response - Response managed by the active HTTP adapter
   */
  async use(_request: unknown, response: unknown): Promise<void> {
    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.setHeader(
      response,
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    const result = await this.healthCheckService.check();
    httpAdapter.reply(response, result, 200);
  }
}
