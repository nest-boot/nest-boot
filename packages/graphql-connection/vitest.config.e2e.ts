import { createRequire } from "node:module";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // Use the same GraphQL runtime as Nest when building the schema.
    alias: [
      {
        find: /^graphql$/,
        replacement: createRequire(import.meta.url).resolve("graphql"),
      },
    ],
  },
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts"],
      reportsDirectory: "coverage/e2e",
      reporter: ["text", "html", "clover", "json"],
    },
  },
});
