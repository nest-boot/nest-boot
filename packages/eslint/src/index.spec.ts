import type { ESLint } from "eslint";

import nestBoot from "./index.js";
import { rules } from "./rules/index.js";

describe("@nest-boot/eslint public plugin API", () => {
  it("exports a standard ESLint plugin with meta, rules, and recommended config", () => {
    const asPlugin: ESLint.Plugin = nestBoot;
    expect(asPlugin).toBe(nestBoot);
    expect(nestBoot.rules).toBe(rules);
    expect(nestBoot.meta).toMatchObject({
      name: "eslint-plugin-nest-boot",
      namespace: "nest-boot",
    });
    expect(typeof nestBoot.meta.version).toBe("string");
    expect(Object.keys(nestBoot.rules).sort()).toEqual([
      "database-entity-property-config-from-types",
      "database-entity-property-definite-assignment",
      "database-entity-property-no-spread",
      "graphql-field-config-from-types",
      "graphql-field-definite-assignment",
      "graphql-no-direct-nestjs-import",
      "queue-processor-name",
    ]);
    expect(Object.keys(nestBoot.configs)).toEqual(["recommended"]);
    expect(nestBoot.configs.recommended).toHaveLength(1);

    // @ts-expect-error -- `standard` preset was removed
    expect(nestBoot.configs.standard).toBeUndefined();
    // @ts-expect-error -- `rules` was replaced by `configs.recommended`
    expect(nestBoot.configs.rules).toBeUndefined();

    const [recommendedEntry] = nestBoot.configs.recommended;
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
