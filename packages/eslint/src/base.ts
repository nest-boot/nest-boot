import js from "@eslint/js";
import type { Linter } from "eslint";
import prettierConfig from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsEslint from "typescript-eslint";

/**
 * Internal shared base ESLint flat configuration with JavaScript, TypeScript,
 * JSDoc, import sorting, and Prettier rules, without Nest Boot domain rules.
 */
const base: Linter.Config[] = [
  js.configs.recommended,

  ...(tsEslint.configs.strictTypeChecked as Linter.Config[]),
  ...(tsEslint.configs.stylisticTypeChecked as Linter.Config[]),

  jsdoc.configs["flat/recommended-typescript-error"],

  prettierConfig,

  {
    name: "@nest-boot/eslint/base",
    languageOptions: {
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

      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

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

export default base;
