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
      include: ["src/**/*.ts"],
      exclude: [
        "src/test/**",
        "**/*.spec.ts",
        "src/{cli,run-cli,project-loader,ts-node.loader}.ts",
      ],
      reportsDirectory: "coverage/e2e",
      reporter: ["text", "json", "lcov"],
    },
  },
});
