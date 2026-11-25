import { plugin } from "./plugin.js";

describe("nest-boot plugin", () => {
  it("exposes all domain-namespaced rules under a single plugin", () => {
    expect(plugin.meta?.name).toBe("@nest-boot/eslint");
    expect(Object.keys(plugin.rules ?? {}).sort()).toEqual([
      "database/entity-property-config-from-types",
      "database/entity-property-definite-assignment",
      "database/entity-property-no-spread",
      "graphql/field-config-from-types",
      "graphql/field-definite-assignment",
      "graphql/no-direct-nestjs-import",
      "queue/processor-name",
    ]);
  });
});
