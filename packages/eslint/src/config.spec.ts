import nestBoot, { configs } from "./index.js";

describe("eslint configs", () => {
  describe("standard", () => {
    it("enables type-aware parsing and external standard rules without Nest Boot rules", () => {
      const standardEntry = configs.standard.find(
        (entry) => entry.name === "@nest-boot/eslint/standard",
      );

      expect(standardEntry).toBeDefined();
      expect(standardEntry?.languageOptions?.parserOptions).toMatchObject({
        projectService: true,
      });
      expect(standardEntry?.rules).toMatchObject({
        curly: ["error", "all"],
        "simple-import-sort/exports": "error",
        "simple-import-sort/imports": "error",
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

      const nestBootEntries = configs.standard.flatMap((entry) => [
        ...Object.keys(entry.plugins ?? {}).filter(
          (name) => name === "nest-boot" || name.startsWith("@nest-boot/"),
        ),
        ...Object.keys(entry.rules ?? {}).filter(
          (name) =>
            name.startsWith("nest-boot/") || name.startsWith("@nest-boot/"),
        ),
      ]);
      expect(nestBootEntries).toEqual([]);
    });
  });

  describe("rules", () => {
    it("registers the nest-boot plugin and custom rules without external presets", () => {
      expect(configs.rules).toHaveLength(1);
      const [rulesEntry] = configs.rules;

      expect(rulesEntry.name).toBe("@nest-boot/eslint/rules");
      expect(rulesEntry.files).toEqual(["**/*.{ts,mts,cts,tsx}"]);
      expect(rulesEntry.languageOptions).toBeUndefined();
      expect(rulesEntry.plugins).toEqual({ "nest-boot": nestBoot });
      expect(rulesEntry.rules).toEqual({
        "nest-boot/database/entity-property-config-from-types": "error",
        "nest-boot/database/entity-property-definite-assignment": "error",
        "nest-boot/database/entity-property-no-spread": "error",
        "nest-boot/graphql/field-config-from-types": "error",
        "nest-boot/graphql/field-definite-assignment": "error",
        "nest-boot/graphql/no-direct-nestjs-import": "error",
        "nest-boot/queue/processor-name": "error",
      });
    });
  });

  describe("recommended", () => {
    it("combines standard and rules presets in order", () => {
      expect(configs.recommended).toEqual([
        ...configs.standard,
        ...configs.rules,
      ]);
    });
  });
});
