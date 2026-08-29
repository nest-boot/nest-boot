import { Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Registry } from "prom-client";

import { MetricsModule } from "../src/metrics.module";

@Injectable()
class MetricsConsumer {
  constructor(readonly registry: Registry) {}
}

@Module({ providers: [MetricsConsumer] })
class ConsumerModule {}

describe("MetricsModule", () => {
  it("should forward register options to the default metrics collector", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule.register({ prefix: "sync_" })],
    }).compile();

    const registry = moduleRef.get(Registry);
    const metricNames = (await registry.getMetricsAsJSON()).map(
      (metric) => metric.name,
    );

    expect(metricNames).toContain("sync_process_cpu_user_seconds_total");

    await moduleRef.close();
  });

  it("should forward registerAsync options to the default metrics collector", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MetricsModule.registerAsync({
          useFactory: () => Promise.resolve({ prefix: "async_" }),
        }),
      ],
    }).compile();

    const registry = moduleRef.get(Registry);
    const metricNames = (await registry.getMetricsAsJSON()).map(
      (metric) => metric.name,
    );

    expect(metricNames).toContain("async_process_cpu_user_seconds_total");

    await moduleRef.close();
  });

  it("should support static global module registration with default options", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule, ConsumerModule],
    }).compile();

    const registry = moduleRef.get(Registry);
    const consumer = moduleRef.get(MetricsConsumer);
    const metricNames = (await registry.getMetricsAsJSON()).map(
      (metric) => metric.name,
    );

    expect(consumer.registry).toBe(registry);
    expect(metricNames).toContain("process_cpu_user_seconds_total");

    await moduleRef.close();
  });
});
