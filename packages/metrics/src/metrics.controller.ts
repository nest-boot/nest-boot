import { Controller, Get, Res } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Registry, type RegistryContentType } from "prom-client";

@Controller("/metrics")
export class MetricsController {
  constructor(
    private readonly registry: Registry<RegistryContentType>,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  @Get()
  async getMetrics(
    @Res({ passthrough: true }) response: unknown,
  ): Promise<string> {
    this.httpAdapterHost.httpAdapter.setHeader(
      response,
      "Content-Type",
      this.registry.contentType,
    );

    return await this.registry.metrics();
  }
}
