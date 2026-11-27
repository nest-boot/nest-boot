import { SetMetadata } from "@nestjs/common";

import { resolveMetricsOptions } from "./resolve-metrics-options.util.js";

describe("resolveMetricsOptions", () => {
  it("applies /metrics and an empty decorator list by default", () => {
    expect(resolveMetricsOptions()).toEqual({
      path: "/metrics",
      decorators: [],
    });
  });

  it("preserves custom path and decorators", () => {
    const decorator = SetMetadata("metrics-auth", true);
    expect(
      resolveMetricsOptions({
        path: "/internal/metrics",
        decorators: [decorator],
      }),
    ).toEqual({
      path: "/internal/metrics",
      decorators: [decorator],
    });
  });

  it("rejects blank or untrimmed paths and non-function decorators", () => {
    for (const invalidPath of ["", "   ", " /metrics", "/metrics "]) {
      expect(() => resolveMetricsOptions({ path: invalidPath })).toThrow(
        "Metrics path must be a non-empty trimmed string",
      );
    }
    expect(() =>
      resolveMetricsOptions({
        decorators: [null as unknown as ClassDecorator],
      }),
    ).toThrow("Metrics decorators must be an array of class decorators");
  });
});
