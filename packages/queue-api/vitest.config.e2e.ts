import { createRequire } from "node:module";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^graphql$/,
        replacement: createRequire(import.meta.url).resolve("graphql"),
      },
    ],
  },
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    coverage: {
      include: ["dist/**/*.js"],
      exclude: [],
      reportsDirectory: "coverage/e2e",
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
