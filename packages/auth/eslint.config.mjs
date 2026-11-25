import nestBoot from "@nest-boot/eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...nestBoot.configs.recommended,
  {
    // These fixtures exercise Auth with the upstream module or decorators.
    files: [
      "src/core/auth.module.spec.ts",
      "test/api-key-workspace-context.e2e-spec.ts",
      "test/fixtures/auth-feature-bootstrap.fixture.ts",
      "test/fixtures/auth-workspace-bootstrap.fixture.ts",
      "test/permission-output.e2e-spec.ts",
      "test/system-account-api.e2e-spec.ts",
    ],
    rules: { "nest-boot/graphql/no-direct-nestjs-import": "off" },
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
