import config from "@nest-boot/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...config,
  {
    // Preserve the existing GraphQL resolver mock conventions after the package merge.
    files: ["src/resolvers/**/*.spec.ts", "src/features/**/*.resolver.spec.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
]);
