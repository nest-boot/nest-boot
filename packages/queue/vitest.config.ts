import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    // Allow the registration test to replace Redis transports inside Nest's explorer.
    server: { deps: { inline: ["@nestjs/bullmq"] } },
    globals: true,
    root: "./",
    include: ["**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts"],
      reportsDirectory: "coverage/unit",
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
