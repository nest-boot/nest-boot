import plugin from "./index.js";

describe("plugin public API", () => {
  it("should export the rule map through the plugin entrypoint", () => {
    expect(plugin.rules).toBeDefined();
    expect(plugin.rules?.["graphql-field-config-from-types"]).toBeDefined();
  });
});
