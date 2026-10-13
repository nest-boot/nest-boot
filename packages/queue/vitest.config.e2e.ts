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
    include: ["**/*.e2e-spec.ts"],
    coverage: {
      include: ["dist/**/*.js"],
      exclude: [],
      reportsDirectory: "coverage/e2e",
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
