import { rules } from "./index.js";

describe("rules", () => {
  it("should expose all packaged rules", () => {
    expect(Object.keys(rules).sort()).toEqual([
      "entity-property-config-from-types",
      "entity-property-definite-assignment",
      "entity-property-no-spread",
      "graphql-field-config-from-types",
      "graphql-field-definite-assignment",
    ]);
  });
});
