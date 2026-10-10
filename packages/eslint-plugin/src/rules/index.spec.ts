import { rules } from "./index.js";

describe("rules", () => {
  it("should expose all packaged rules", () => {
    expect(Object.keys(rules).sort()).toEqual([
      "entity-field-definite-assignment",
      "entity-property-config-from-types",
      "graphql-field-config-from-types",
      "graphql-field-definite-assignment",
      "import-database",
      "import-graphql",
      "import-queue",
    ]);
  });
});
