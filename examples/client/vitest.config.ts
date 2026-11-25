import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    passWithNoTests: true,
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.spec.{ts,tsx}"],
      reporter: ["text", "html", "json", "json-summary"],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.spec.{ts,tsx}", "eslint/**/*.spec.mjs"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.spec.{ts,tsx}"],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
