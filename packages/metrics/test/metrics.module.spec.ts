import { Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { MetricsModule, Registry } from "../src";

@Injectable()
class MetricsConsumer {
  constructor(readonly registry: Registry) {}
}

@Module({ providers: [MetricsConsumer] })
class ConsumerModule {}

describe("MetricsModule", () => {
  it("should forward register options to the default metrics collector", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MetricsModule.register({
          labels: { service: "sync-test" },
          prefix: "sync_",
        }),
      ],
    }).compile();

    const registry = moduleRef.get(Registry);
    const metricNames = (await registry.getMetricsAsJSON()).map(
      (metric) => metric.name,
    );

    expect(metricNames).toContain("sync_process_cpu_user_seconds_total");
    expect(
      (
        await registry.getSingleMetricAsString(
          "sync_process_cpu_user_seconds_total",
        )
      ).includes('service="sync-test"'),
    ).toBe(true);

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
