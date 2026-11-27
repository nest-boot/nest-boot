import { Controller, Get, Res, VERSION_NEUTRAL } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Registry, type RegistryContentType } from "prom-client";

/** Exposes Prometheus metrics collected in the module registry. */
@Controller({ path: "/metrics", version: VERSION_NEUTRAL })
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
