import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const clientUrl = process.env.CLIENT_E2E_URL ?? "http://127.0.0.1:3100";
const serverUrl = process.env.SERVER_E2E_URL ?? "http://127.0.0.1:4100";
const clientPort = new URL(clientUrl).port || "80";
const serverPort = new URL(serverUrl).port || "80";
const clientHealthUrl = `http://[::1]:${clientPort}`;
const serverHealthUrl = `http://[::1]:${serverPort}`;
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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: configuredWorkers,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: clientUrl,
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Shanghai",
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
        ? "pnpm --filter @nest-boot/example-server start:e2e"
        : "pnpm --filter @nest-boot/example-server build && pnpm --filter @nest-boot/example-server start:e2e",
      cwd: workspaceRoot,
      env: { PORT: serverPort, APP_URL: clientUrl, AUTH_URL: serverUrl },
      gracefulShutdown: {
        signal: "SIGTERM",
        timeout: 30_000,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${serverHealthUrl}/api/auth/ok`,
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
