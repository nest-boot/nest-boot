import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["**/*.spec.ts"],
    coverage: {
      // Use the same TypeScript output as the E2E suite, including Nest metadata.
      // Source maps retain TS locations without Vite's synthetic decorator branches.
      include: ["dist/**/*.js"],
      exclude: [],
      reportsDirectory: "coverage/unit",
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
