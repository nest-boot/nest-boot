import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
