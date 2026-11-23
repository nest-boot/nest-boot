import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts"],
      reportsDirectory: "coverage/unit",
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
