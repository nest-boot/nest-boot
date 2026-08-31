import config from "@nest-boot/eslint-config";

describe("eslint config", () => {
  it("enables type-aware parsing and the Nest Boot rules", () => {
    const nestBootConfig = config.find(
      (entry) => entry.plugins?.["@nest-boot"] !== undefined,
    );

    expect(nestBootConfig).toBeDefined();
    expect(nestBootConfig?.languageOptions?.parserOptions).toMatchObject({
      projectService: true,
    });
    expect(nestBootConfig?.rules).toMatchObject({
      "@nest-boot/entity-field-definite-assignment": "error",
      "@nest-boot/entity-property-config-from-types": "error",
      "@nest-boot/graphql-field-definite-assignment": "error",
      "@nest-boot/graphql-field-config-from-types": "error",
      "@nest-boot/import-bullmq": "error",
      "@nest-boot/import-graphql": "error",
      "@nest-boot/import-mikro-orm": "error",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
      "tsdoc/syntax": "error",
    });
  });

  it("keeps the intentional TypeScript rule overrides", () => {
    const nestBootConfig = config.find(
      (entry) => entry.plugins?.["@nest-boot"] !== undefined,
    );

    expect(nestBootConfig?.rules).toMatchObject({
      "@typescript-eslint/no-empty-function": [
        "error",
        { allow: ["constructors"] },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/return-await": ["error", "always"],
    });
  });
});
