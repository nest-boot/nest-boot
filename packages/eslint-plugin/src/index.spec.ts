import plugin, { queuePlugin } from "./index.js";

describe("plugin public API", () => {
  it("should export the rule map through the plugin entrypoint", () => {
    expect(plugin.rules).toBeDefined();
    expect(plugin.rules?.["graphql-field-config-from-types"]).toBeDefined();
    expect(plugin.rules?.["processor-name"]).toBeUndefined();
  });

  it("exposes queue rules through their own plugin namespace", () => {
    expect(Object.keys(queuePlugin.rules ?? {})).toEqual(["processor-name"]);
  });

  it("does not expose import migration rules", () => {
    for (const rules of [plugin.rules, queuePlugin.rules]) {
      for (const name of [
        "import-bullmq",
        "import-queue",
        "import-mikro-orm",
        "import-database",
        "import-graphql",
      ]) {
        expect(rules).not.toHaveProperty(name);
      }
    }
  });
});
