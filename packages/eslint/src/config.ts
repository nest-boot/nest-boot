import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import type { Linter } from "eslint";
import prettierConfig from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsEslint from "typescript-eslint";

import { plugin } from "./plugin.js";

/**
 * Shared standard ESLint presets and TypeScript/JSDoc/Prettier rules without
 * Nest Boot domain-specific rules.
 */
const standardConfig: Linter.Config[] = [
  js.configs.recommended,

  // TypeScript 严格类型检查配置
  ...(tsEslint.configs.strictTypeChecked as Linter.Config[]),
  ...(tsEslint.configs.stylisticTypeChecked as Linter.Config[]),

  jsdoc.configs["flat/recommended-typescript-error"],

  // Prettier 配置
  prettierConfig,

  // TypeScript 和外部插件配置
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
      // 基础规则
      curly: ["error", "all"],
      "no-void": "off",
      "no-use-before-define": "off",

      // 导入排序
      "import/order": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // 禁用 no-unused-expressions 和 @typescript-eslint/no-unused-expressions
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",

      // TypeScript 规则
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
 * Nest Boot custom rules preset without external rule sets or parser option
 * overrides, intended for projects that manage their own base ESLint config.
 */
const rulesConfig: Linter.Config[] = [
  {
    name: "@nest-boot/eslint/rules",
    files: ["**/*.{ts,mts,cts,tsx}"],
    plugins: {
      "nest-boot": plugin,
    },
    rules: {
      "nest-boot/database/entity-property-config-from-types": "error",
      "nest-boot/database/entity-property-definite-assignment": "error",
      "nest-boot/database/entity-property-no-spread": "error",
      "nest-boot/graphql/field-config-from-types": "error",
      "nest-boot/graphql/field-definite-assignment": "error",
      "nest-boot/graphql/no-direct-nestjs-import": "error",
      "nest-boot/queue/processor-name": "error",
    },
  },
];

/**
 * Full shared ESLint flat configuration combining `configs.standard` and
 * `configs.rules`.
 */
const recommendedConfig: Linter.Config[] = [...standardConfig, ...rulesConfig];

/** Flat configuration presets exported by `@nest-boot/eslint`. */
export const configs: {
  readonly standard: Linter.Config[];
  readonly rules: Linter.Config[];
  readonly recommended: Linter.Config[];
} = {
  standard: standardConfig,
  rules: rulesConfig,
  recommended: recommendedConfig,
};
