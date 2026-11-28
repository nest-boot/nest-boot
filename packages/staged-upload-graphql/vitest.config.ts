import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [{ find: /^graphql$/, replacement: "graphql/index.js" }],
  },
  test: {
    globals: true,
    root: "./",
    passWithNoTests: true,
    coverage: {
      exclude: ["**/*.spec.ts", "**/*.spec-d.ts", "bin/**", "test/**"],
      autoAttachSubprocess: true,
      reporter: ["text", "html", "json", "json-summary"],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.spec.ts"],
          testTimeout: 15000,
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.spec.ts"],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.spec.ts"],
          testTimeout: 60000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
