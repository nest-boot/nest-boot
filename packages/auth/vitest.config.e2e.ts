import { fileURLToPath } from "node:url";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: { graphql: fileURLToPath(import.meta.resolve("graphql")) },
  },
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    coverage: {
      include: ["dist/**/*.js"],
      exclude: ["dist/test/**"],
      reportsDirectory: "coverage/e2e",
      reporter: ["text", "html", "clover", "json"],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
