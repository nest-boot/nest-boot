import js from "@eslint/js";
import parser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { configs } from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,

  // TypeScript 严格类型检查配置
  ...configs.strictTypeChecked,
  ...configs.stylisticTypeChecked,

  // Prettier 配置
  prettierConfig,

  // TypeScript 配置
  {
    languageOptions: {
      parser,
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
  },

  // Simple Import Sort 配置
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "import/order": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
];
