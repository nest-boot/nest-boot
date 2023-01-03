import { Controller, Get } from "@nestjs/common";
import { Registry } from "prom-client";

@Controller("/metrics")
export class MetricsController {
  constructor(private readonly registry: Registry) {}

  @Get()
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}
