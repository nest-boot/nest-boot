import library from "@nest-boot/eslint/library";
import { defineConfig } from "eslint/config";
import eslintPlugin from "eslint-plugin-eslint-plugin";

export default defineConfig([
  ...library,
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
