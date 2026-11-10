import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    coverage: {
      reportsDirectory: "coverage/e2e",
      include: ["dist/**/*.js"],
      exclude: ["dist/test/**"],
      reporter: ["text", "html", "clover", "json"],
    },
  },
});
