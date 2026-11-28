import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { createExampleServerE2eEnv, getE2eUrls } from "./e2e/utils/server-env";

const { clientUrl, serverUrl, clientPort, clientHealthUrl, serverHealthUrl } =
  getE2eUrls();
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
const parsedWorkers = Number(process.env.PLAYWRIGHT_WORKERS);
const configuredWorkers =
  Number.isInteger(parsedWorkers) && parsedWorkers > 0
    ? parsedWorkers
    : process.env.CI
      ? 3
      : undefined;
const skipBuild =
  process.env.E2E_SKIP_BUILD === "1" || process.env.E2E_SKIP_BUILD === "true";
const clientDir = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(clientDir, "../..");
const serverDir = resolve(workspaceRoot, "examples/server");
const serverEnv = createExampleServerE2eEnv();

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: configuredWorkers,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never" }],
        ["./e2e/utils/database-cleanup-reporter.ts"],
      ]
    : [["list"], ["./e2e/utils/database-cleanup-reporter.ts"]],
  use: {
    baseURL: clientUrl,
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  webServer: [
    {
      command: skipBuild
        ? "node dist/cli.js database migration up && node dist/main.js"
        : "pnpm build && node dist/cli.js database migration up && node dist/main.js",
      cwd: serverDir,
      env: serverEnv,
      gracefulShutdown: {
        signal: "SIGTERM",
        timeout: 30_000,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${serverHealthUrl}/api/auth/ok`,
    },
    {
      command: "node dist/cli.js queue start",
      cwd: serverDir,
      env: serverEnv,
      gracefulShutdown: {
        signal: "SIGTERM",
        timeout: 30_000,
      },
      reuseExistingServer: false,
      timeout: 60_000,
      wait: {
        stdout: /Queue workers running:/,
      },
    },
    {
      command: skipBuild
        ? `pnpm --filter @nest-boot/example-client exec vite preview --mode e2e --host :: --port ${clientPort} --strictPort`
        : `pnpm --filter @nest-boot/example-client codegen && pnpm --filter @nest-boot/example-client exec vite build --mode e2e && pnpm --filter @nest-boot/example-client exec vite preview --mode e2e --host :: --port ${clientPort} --strictPort`,
      cwd: workspaceRoot,
      env: { APP_URL: clientUrl, API_URL: serverUrl },
      gracefulShutdown: {
        signal: "SIGTERM",
        timeout: 30_000,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: clientHealthUrl,
    },
  ],
});
