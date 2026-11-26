import nestBoot, { configs, meta, rules } from "./index.js";

describe("@nest-boot/eslint public plugin API", () => {
  it("exports a standard ESLint plugin with meta, rules, and recommended config", () => {
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
    expect(Object.keys(configs)).toEqual(["recommended"]);
    expect(configs.recommended).toHaveLength(1);

    const [recommendedEntry] = configs.recommended;
    expect(recommendedEntry.name).toBe("@nest-boot/eslint/recommended");
    expect(recommendedEntry.files).toEqual(["**/*.{ts,mts,cts,tsx}"]);
    expect(recommendedEntry.languageOptions).toBeUndefined();
    expect(recommendedEntry.plugins).toEqual({ "nest-boot": nestBoot });
    expect(recommendedEntry.rules).toEqual({
      "nest-boot/database-entity-property-config-from-types": "error",
      "nest-boot/database-entity-property-definite-assignment": "error",
      "nest-boot/database-entity-property-no-spread": "error",
      "nest-boot/graphql-field-config-from-types": "error",
      "nest-boot/graphql-field-definite-assignment": "error",
      "nest-boot/graphql-no-direct-nestjs-import": "error",
      "nest-boot/queue-processor-name": "error",
    });
  });
});
