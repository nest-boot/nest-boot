import library from "@nest-boot/eslint/library";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...library,
  {
    // These fixtures exercise Auth with the upstream module or decorators.
    files: [
      "src/core/auth.module.spec.ts",
      "src/core/auth.module.spec-d.ts",
      "test/e2e/api-key-workspace-context.spec.ts",
      "test/fixtures/auth-feature-bootstrap.fixture.ts",
      "test/fixtures/auth-workspace-bootstrap.fixture.ts",
      "test/e2e/permission-output.spec.ts",
      "test/e2e/system-account-api.spec.ts",
    ],
    rules: { "nest-boot/graphql-no-direct-nestjs-import": "off" },
  },
  {
    // Preserve the existing GraphQL resolver mock conventions after the package merge.
    files: ["src/*/resolvers/**/*.spec.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
]);
