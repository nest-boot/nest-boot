import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import type { ESLint, Linter } from "eslint";
import prettierConfig from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsEslint from "typescript-eslint";

/** Flat configuration presets exported by `@nest-boot/eslint`. */
export interface NestBootConfigs extends Record<string, Linter.Config[]> {
  readonly standard: Linter.Config[];
  readonly rules: Linter.Config[];
  readonly recommended: Linter.Config[];
}

/**
 * Shared standard ESLint presets and TypeScript/JSDoc/Prettier rules without
 * Nest Boot domain-specific rules.
 */
const standardConfig: Linter.Config[] = [
  js.configs.recommended,

  ...(tsEslint.configs.strictTypeChecked as Linter.Config[]),
  ...(tsEslint.configs.stylisticTypeChecked as Linter.Config[]),

  jsdoc.configs["flat/recommended-typescript-error"],

  prettierConfig,

  {
    name: "@nest-boot/eslint/standard",
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      curly: ["error", "all"],
      "no-void": "off",
      "no-use-before-define": "off",

      "import/order": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",

      "@typescript-eslint/no-empty-function": [
        "error",
        { allow: ["constructors"] },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-misused-spread": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-class-instance-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/return-await": ["error", "always"],
    },
  },
];

/**
 * Builds the flat config presets bound to the given `nest-boot` plugin instance.
 * @param plugin - The ESLint plugin object to register under `"nest-boot"`.
 * @returns The `standard`, `rules`, and `recommended` flat config arrays.
 */
export function createConfigs(plugin: ESLint.Plugin): NestBootConfigs {
  const rulesConfig: Linter.Config[] = [
    {
      name: "@nest-boot/eslint/rules",
      files: ["**/*.{ts,mts,cts,tsx}"],
      plugins: {
        "nest-boot": plugin,
      },
      rules: {
        "nest-boot/database-entity-property-config-from-types": "error",
        "nest-boot/database-entity-property-definite-assignment": "error",
        "nest-boot/database-entity-property-no-spread": "error",
        "nest-boot/graphql-field-config-from-types": "error",
        "nest-boot/graphql-field-definite-assignment": "error",
        "nest-boot/graphql-no-direct-nestjs-import": "error",
        "nest-boot/queue-processor-name": "error",
      },
    },
  ];

  return {
    standard: standardConfig,
    rules: rulesConfig,
    recommended: [...standardConfig, ...rulesConfig],
  };
}
