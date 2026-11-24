import config from "@nest-boot/eslint-config";

describe("eslint config", () => {
  it("enables type-aware parsing and the Nest Boot rules", () => {
    const nestBootConfig = config.find(
      (entry) => entry.plugins?.["@nest-boot/database"] !== undefined,
    );

    expect(nestBootConfig).toBeDefined();
    expect(
      Object.keys(nestBootConfig?.plugins ?? {})
        .filter(
          (name) => name === "@nest-boot" || name.startsWith("@nest-boot/"),
        )
        .sort(),
    ).toEqual([
      "@nest-boot/database",
      "@nest-boot/graphql",
      "@nest-boot/queue",
    ]);
    expect(nestBootConfig?.languageOptions?.parserOptions).toMatchObject({
      projectService: true,
    });
    expect(nestBootConfig?.rules).toMatchObject({
      curly: ["error", "all"],
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
    });
  });

  it("configures the complete set of namespaced rules at error severity", () => {
    const nestBootRules = Object.fromEntries(
      config.flatMap((entry) =>
        Object.entries(entry.rules ?? {}).filter(([name]) =>
          name.startsWith("@nest-boot/"),
        ),
      ),
    );

    expect(nestBootRules).toEqual({
      "@nest-boot/database/entity-property-config-from-types": "error",
      "@nest-boot/database/entity-property-definite-assignment": "error",
      "@nest-boot/database/entity-property-no-spread": "error",
      "@nest-boot/graphql/field-config-from-types": "error",
      "@nest-boot/graphql/field-definite-assignment": "error",
      "@nest-boot/queue/processor-name": "error",
    });
  });

  it("keeps the intentional TypeScript rule overrides", () => {
    const nestBootConfig = config.find(
      (entry) => entry.plugins?.["@nest-boot/database"] !== undefined,
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
