import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      include: ["dist/**/*.js"],
      exclude: ["dist/test/**"],
      reportsDirectory: "coverage/e2e",
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
