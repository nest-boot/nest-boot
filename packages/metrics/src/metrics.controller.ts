import { Controller, Get, Header } from "@nestjs/common";
import { Registry } from "prom-client";

@Controller("/metrics")
export class MetricsController {
  constructor(private readonly registry: Registry) {}

  @Get()
  @Header("Content-Type", Registry.PROMETHEUS_CONTENT_TYPE)
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}
