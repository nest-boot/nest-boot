import { fileURLToPath } from "node:url";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Match Nest's Node entry point instead of loading a second GraphQL scalar implementation.
  resolve: {
    alias: { graphql: fileURLToPath(import.meta.resolve("graphql")) },
  },
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ["./test/setup.ts"],
    globals: true,
    root: "./",
    include: ["**/*.spec.ts"],
  },
});
