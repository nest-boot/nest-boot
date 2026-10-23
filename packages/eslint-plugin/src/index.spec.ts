import plugin from "./index.js";

describe("plugin public API", () => {
  it("should export the rule map through the plugin entrypoint", () => {
    expect(plugin.rules).toBeDefined();
    expect(plugin.rules?.["graphql-field-config-from-types"]).toBeDefined();
  });

  it("does not expose import migration rules", () => {
    for (const name of [
      "import-bullmq",
      "import-queue",
      "import-mikro-orm",
      "import-database",
      "import-graphql",
    ]) {
      expect(plugin.rules).not.toHaveProperty(name);
    }
  });
});
