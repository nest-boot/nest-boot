import { Controller, Get, Header } from "@nestjs/common";
import { contentType, Registry } from "prom-client";

@Controller("/metrics")
export class MetricsController {
  constructor(private readonly registry: Registry) {}

  @Get()
  @Header("Content-Type", contentType)
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}
