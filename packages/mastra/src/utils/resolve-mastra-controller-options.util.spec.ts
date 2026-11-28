import { Mastra } from "@mastra/core/mastra";
import { SetMetadata } from "@nestjs/common";

import { DEFAULT_MASTRA_SERVER_PREFIX } from "../mastra.constants.js";
import { resolveMastraControllerOptions } from "./resolve-mastra-controller-options.util.js";

describe("resolveMastraControllerOptions", () => {
  it("defaults to disabled, /api/mastra, and @Can('manage', Mastra)", () => {
    const resolved = resolveMastraControllerOptions();
    expect(resolved.enabled).toBe(false);
    expect(resolved.path).toBe(DEFAULT_MASTRA_SERVER_PREFIX);
    expect(resolved.decorators).toHaveLength(1);

    class TestController {}
    for (const decorator of resolved.decorators) {
      decorator(TestController);
    }
    const [firstMetadataKey] = Reflect.getOwnMetadataKeys(TestController);
    expect(firstMetadataKey).toBeDefined();
    expect(
      Reflect.getMetadata(firstMetadataKey as symbol, TestController),
    ).toEqual([{ action: "manage", subject: Mastra }]);
  });

  it("supports custom prefix and custom or empty decorators", () => {
    const decorator = SetMetadata("mastra-custom", true);
    expect(
      resolveMastraControllerOptions({
        prefix: "/custom/mastra",
        decorators: [decorator],
      }),
    ).toEqual({
      enabled: true,
      path: "/custom/mastra",
      decorators: [decorator],
    });
    expect(resolveMastraControllerOptions({ decorators: [] })).toEqual({
      enabled: true,
      path: DEFAULT_MASTRA_SERVER_PREFIX,
      decorators: [],
    });
  });

  it("rejects non-function entries in server.decorators", () => {
    expect(() =>
      resolveMastraControllerOptions({
        decorators: ["bad" as unknown as ClassDecorator],
      }),
    ).toThrow("Mastra server.decorators must be an array of class decorators");
  });
});
