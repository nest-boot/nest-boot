import { resolve } from "node:path";

import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2023",
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    root: "./",
    setupFiles: [resolve(import.meta.dirname, "../../vitest.setup.ts")],
    include: ["**/*.spec.ts"],
    exclude: ["dist/**", "node_modules/**", "**/*.e2e-spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts"],
      excludeAfterRemap: true,
      reportsDirectory: "./coverage",
      provider: "v8",
    },
  },
});
