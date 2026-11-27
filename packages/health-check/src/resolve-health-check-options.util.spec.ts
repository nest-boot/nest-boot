import { IS_PUBLIC_KEY } from "@nest-boot/common";
import { SetMetadata } from "@nestjs/common";

import { resolveHealthCheckOptions } from "./resolve-health-check-options.util.js";

describe("resolveHealthCheckOptions", () => {
  it("applies /health and @Public() by default", () => {
    const resolved = resolveHealthCheckOptions();
    expect(resolved.path).toBe("/health");
    expect(resolved.decorators).toHaveLength(1);

    class TestController {}
    for (const decorator of resolved.decorators) {
      decorator(TestController);
    }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestController)).toBe(true);
  });

  it("preserves custom path and decorators including an empty decorator list", () => {
    const customDecorator = SetMetadata("custom", true);
    expect(
      resolveHealthCheckOptions({
        path: "/readyz",
        decorators: [customDecorator],
      }),
    ).toEqual({
      path: "/readyz",
      decorators: [customDecorator],
    });
    expect(resolveHealthCheckOptions({ decorators: [] }).decorators).toEqual(
      [],
    );
  });

  it("rejects blank or untrimmed paths and non-function decorators", () => {
    for (const invalidPath of ["", "   ", " /health", "/health "]) {
      expect(() => resolveHealthCheckOptions({ path: invalidPath })).toThrow(
        "Health check path must be a non-empty trimmed string",
      );
    }
    expect(() =>
      resolveHealthCheckOptions({
        decorators: ["invalid" as unknown as ClassDecorator],
      }),
    ).toThrow("Health check decorators must be an array of class decorators");
  });
});
