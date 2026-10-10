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
const clientDir = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(clientDir, "../..");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
      command:
        "pnpm --filter @nest-boot/example-server build && pnpm --filter @nest-boot/example-server start:e2e",
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
      command: `pnpm --filter @nest-boot/example-client codegen && pnpm --filter @nest-boot/example-client exec vite dev --mode e2e --host :: --port ${clientPort} --strictPort`,
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
