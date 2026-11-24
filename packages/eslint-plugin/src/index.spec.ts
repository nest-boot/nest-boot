import { databasePlugin, graphqlPlugin, queuePlugin } from "./index.js";

describe("plugin public API", () => {
  it("exposes database rules through their own plugin namespace", () => {
    expect(Object.keys(databasePlugin.rules ?? {}).sort()).toEqual([
      "entity-property-config-from-types",
      "entity-property-definite-assignment",
      "entity-property-no-spread",
    ]);
  });

  it("exposes GraphQL rules through their own plugin namespace", () => {
    expect(Object.keys(graphqlPlugin.rules ?? {}).sort()).toEqual([
      "field-config-from-types",
      "field-definite-assignment",
    ]);
  });

  it("exposes queue rules through their own plugin namespace", () => {
    expect(Object.keys(queuePlugin.rules ?? {})).toEqual(["processor-name"]);
  });
});
