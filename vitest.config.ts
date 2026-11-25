import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      include: ["packages/*/src/**/*.ts", "packages/*/dist/**/*.js"],
      exclude: ["**/*.spec.ts", "packages/*/dist/test/**"],
      autoAttachSubprocess: true,
      reporter: ["text", "html", "json", "json-summary"],
    },
    projects: ["packages/*/vitest.config.ts", "examples/*/vitest.config.ts"],
  },
});
