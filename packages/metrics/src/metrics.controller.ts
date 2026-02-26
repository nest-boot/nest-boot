import { Controller, Get } from "@nestjs/common";
import { Registry } from "prom-client";

/**
 * Controller to expose Prometheus metrics.
 */
@Controller("/metrics")
export class MetricsController {
  constructor(private readonly registry: Registry) {}

  /**
   * Endpoint to retrieve metrics.
   *
   * @returns A promise that resolves to the metrics string.
   */
  @Get()
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}
