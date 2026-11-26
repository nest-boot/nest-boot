import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    passWithNoTests: true,
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.spec.{ts,tsx}",
        "src/components/ui/**",
        "src/components/thread-ui/**",
        "src/gql/**",
        "src/routeTree.gen.ts",
      ],
      reporter: ["text", "html", "json", "json-summary"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.spec.{ts,tsx}", "eslint/**/*.spec.mjs"],
          exclude: [
            "**/node_modules/**",
            "src/components/ui/**",
            "src/components/thread-ui/**",
          ],
        },
      },
      {
        extends: true,
        plugins: [tailwindcss()],
        test: {
          name: "integration",
          include: ["test/integration/**/*.spec.{ts,tsx}"],
          setupFiles: ["./test/integration/setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          browser: {
            enabled: true,
            headless: true,
            ui: false,
            screenshotFailures: false,
            dependencySourcemaps: false,
            viewport: {
              width: 1280,
              height: 800,
            },
            provider: playwright({
              ...(browserChannel
                ? { launchOptions: { channel: browserChannel } }
                : {}),
              contextOptions: {
                locale: "en-US",
                timezoneId: "Asia/Shanghai",
              },
            }),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
