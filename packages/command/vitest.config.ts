import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      // CLI bootstrap and loader coverage comes from c8's real child processes.
      exclude: [
        "src/test/**",
        "**/*.spec.ts",
        "src/{cli,run-cli,project-loader,ts-node.loader}.ts",
      ],
      reporter: ["text", "json", "lcov"],
    },
  },
});
