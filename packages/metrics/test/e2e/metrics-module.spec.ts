import { Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { MetricsModule, Registry } from "../../src/index.js";

@Injectable()
class MetricsConsumer {
  constructor(readonly registry: Registry) {}
}

@Module({ providers: [MetricsConsumer] })
class ConsumerModule {}

describe("MetricsModule", () => {
  it("should forward forRoot options to the default metrics collector", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MetricsModule.forRoot({
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

  it("should forward forRootAsync options to the default metrics collector", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MetricsModule.forRootAsync({
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

  it.each([false, true])(
    "should support class-based re-exports of configured MetricsModule (async: %s)",
    async (asyncRegistration) => {
      @Module({
        imports: [
          asyncRegistration
            ? MetricsModule.forRootAsync({
                useFactory: () => ({ prefix: "reexport_" }),
              })
            : MetricsModule.forRoot({ prefix: "reexport_" }),
        ],
        exports: [MetricsModule],
      })
      class SharedMetricsModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [SharedMetricsModule, ConsumerModule],
      }).compile();

      const consumer = moduleRef.get(MetricsConsumer);
      const metricNames = (await consumer.registry.getMetricsAsJSON()).map(
        (metric) => metric.name,
      );
      expect(metricNames).toContain("reexport_process_cpu_user_seconds_total");

      await moduleRef.close();
    },
  );
});
