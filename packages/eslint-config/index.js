const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tseslint = require("typescript-eslint");
const nestBootPlugin = require("@nest-boot/eslint-plugin");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const prettierConfig = require("eslint-config-prettier");
const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  js.configs.recommended,

  // 使用 FlatCompat 包装 Standard 配置
  ...compat.extends("standard"),

  // TypeScript 严格类型检查配置
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // TypeScript 和插件配置
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        project: ["tsconfig.json"],
      },
      globals: {
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        console: "readonly",
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
      "@typescript-eslint/return-await": ["error", "always"],
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": [
        "error",
        { allow: ["constructors"] },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],

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

  prettierConfig,
];
