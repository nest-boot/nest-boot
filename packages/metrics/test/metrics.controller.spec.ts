import { Registry } from "prom-client";

import { MetricsController } from "../src/metrics.controller";

describe("MetricsController", () => {
  it("should return metrics serialized by the module registry", async () => {
    const exposition =
      "# HELP test_counter A test counter\n" +
      "# TYPE test_counter counter\n" +
      "test_counter 1\n";
    const metrics = jest.fn().mockResolvedValue(exposition);
    const controller = new MetricsController({
      metrics,
    } as unknown as Registry);

    await expect(controller.getMetrics()).resolves.toBe(exposition);
    expect(metrics).toHaveBeenCalledTimes(1);
  });

  it("should propagate registry serialization failures", async () => {
    const error = new Error("serialization failed");
    const metrics = jest.fn().mockRejectedValue(error);
    const controller = new MetricsController({
      metrics,
    } as unknown as Registry);

    await expect(controller.getMetrics()).rejects.toBe(error);
  });
});
