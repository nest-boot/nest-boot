import nestBoot, { configs, meta, rules } from "./index.js";

describe("@nest-boot/eslint public plugin API", () => {
  it("exports a standard ESLint plugin with meta, rules, and configs", () => {
    expect(nestBoot.meta).toBe(meta);
    expect(nestBoot.rules).toBe(rules);
    expect(nestBoot.configs).toBe(configs);
    expect(meta).toMatchObject({
      name: "eslint-plugin-nest-boot",
      namespace: "nest-boot",
    });
    expect(typeof meta.version).toBe("string");
    expect(Object.keys(rules).sort()).toEqual([
      "database-entity-property-config-from-types",
      "database-entity-property-definite-assignment",
      "database-entity-property-no-spread",
      "graphql-field-config-from-types",
      "graphql-field-definite-assignment",
      "graphql-no-direct-nestjs-import",
      "queue-processor-name",
    ]);
    expect(Array.isArray(configs.standard)).toBe(true);
    expect(Array.isArray(configs.rules)).toBe(true);
    expect(Array.isArray(configs.recommended)).toBe(true);
  });
});
