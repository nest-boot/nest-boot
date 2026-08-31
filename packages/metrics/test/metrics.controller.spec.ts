import { type HttpAdapterHost } from "@nestjs/core";
import { Registry, type RegistryContentType } from "prom-client";

import { MetricsController } from "../src/metrics.controller";

describe("MetricsController", () => {
  it("should return metrics serialized by the module registry", async () => {
    const exposition =
      "# HELP test_counter A test counter\n" +
      "# TYPE test_counter counter\n" +
      "test_counter 1\n";
    const metrics = jest.fn().mockResolvedValue(exposition);
    const setHeader = jest.fn();
    const controller = new MetricsController(
      {
        contentType:
          "application/openmetrics-text; version=1.0.0; charset=utf-8",
        metrics,
      } as unknown as Registry<RegistryContentType>,
      {
        httpAdapter: { setHeader },
      } as unknown as HttpAdapterHost,
    );
    const response = {};

    await expect(controller.getMetrics(response)).resolves.toBe(exposition);
    expect(setHeader).toHaveBeenCalledWith(
      response,
      "Content-Type",
      "application/openmetrics-text; version=1.0.0; charset=utf-8",
    );
    expect(metrics).toHaveBeenCalledTimes(1);
  });

  it("should propagate registry serialization failures", async () => {
    const error = new Error("serialization failed");
    const metrics = jest.fn().mockRejectedValue(error);
    const setHeader = jest.fn();
    const controller = new MetricsController(
      {
        contentType: "text/plain; version=0.0.4; charset=utf-8",
        metrics,
      } as unknown as Registry<RegistryContentType>,
      {
        httpAdapter: { setHeader },
      } as unknown as HttpAdapterHost,
    );

    await expect(controller.getMetrics({})).rejects.toBe(error);
    expect(setHeader).toHaveBeenCalledTimes(1);
  });
});
