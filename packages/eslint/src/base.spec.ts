import base from "./base.js";

describe("internal base preset", () => {
  it("enables type-aware parsing and external base rules without Nest Boot rules", () => {
    const baseEntry = base.find(
      (entry) => entry.name === "@nest-boot/eslint/base",
    );

    expect(baseEntry).toBeDefined();
    expect(baseEntry?.languageOptions?.parserOptions).toMatchObject({
      projectService: true,
    });
    expect(baseEntry?.rules).toMatchObject({
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

    const nestBootEntries = base.flatMap((entry) => [
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
