import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: "./",
    passWithNoTests: true,
    coverage: {
      autoAttachSubprocess: true,
      reporter: ["text", "html", "json", "json-summary"],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["*.spec.ts"],
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
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
