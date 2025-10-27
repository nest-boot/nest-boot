import js from "@eslint/js";
import nestBootPlugin from "@nest-boot/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsEslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  js.configs.recommended,

  // TypeScript 严格类型检查配置
  ...tsEslint.configs.strictTypeChecked,
  ...tsEslint.configs.stylisticTypeChecked,

  // // Prettier 配置
  prettierConfig,

  // TypeScript 和插件配置
  {
    languageOptions: {
      /** @type {import('eslint').Linter.Parser} */
      parser: tsParser,
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
    plugins: {
      "@nest-boot": nestBootPlugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // 基础规则
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

      // NestBoot 自定义规则
      "@nest-boot/entity-field-definite-assignment": "error",
      "@nest-boot/entity-property-config-from-types": "error",
      "@nest-boot/graphql-field-definite-assignment": "error",
      "@nest-boot/graphql-field-config-from-types": "error",
      "@nest-boot/import-bullmq": "error",
      "@nest-boot/import-graphql": "error",
      "@nest-boot/import-mikro-orm": "error",
    },
  },
];

export default config;
