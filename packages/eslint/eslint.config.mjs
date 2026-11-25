import nestBoot from "@nest-boot/eslint";
import { defineConfig } from "eslint/config";
import eslintPlugin from "eslint-plugin-eslint-plugin";

export default defineConfig([
  ...nestBoot.configs.standard,
  eslintPlugin.configs.recommended,
  {
    files: ["src/rules/*.ts"],
    ignores: ["**/*.spec.ts", "src/rules/index.ts"],
    rules: {
      "eslint-plugin/require-meta-docs-description": "error",
      "eslint-plugin/require-meta-docs-recommended": "error",
    },
  },
]);
