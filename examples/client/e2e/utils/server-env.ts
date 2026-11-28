import { randomBytes } from "node:crypto";

const DEFAULT_CLIENT_URL = "http://127.0.0.1:3100";
const DEFAULT_SERVER_URL = "http://127.0.0.1:4100";
const DEFAULT_REDIS_URL = "redis://127.0.0.1:36379/0";
const DEFAULT_SMTP_URL = "smtp://127.0.0.1:31025";

function getOrCreateEnvSecret(envKey: string): string {
  const existing = process.env[envKey];
  if (existing) {
    return existing;
  }
  const generated = randomBytes(32).toString("base64url");
  process.env[envKey] = generated;
  return generated;
}

function resolveDefaultAdminDatabaseUrl(): string {
  const url = new URL("postgresql://127.0.0.1:35432/postgres");
  url.username = process.env.POSTGRES_USER ?? "postgres";
  url.password = process.env.POSTGRES_PASSWORD ?? "secret";
  return url.toString();
}

export function getE2eAdminDatabaseUrl(): string {
  return (
    process.env.SERVER_E2E_DATABASE_URL ?? resolveDefaultAdminDatabaseUrl()
  );
}

export function getOrCreateE2eDatabaseName(): string {
  const existing = process.env.PLAYWRIGHT_E2E_DB_NAME;
  if (existing) {
    return existing;
  }
  const generated = `nest_boot_example_e2e_${process.pid}_${Date.now()}`;
  process.env.PLAYWRIGHT_E2E_DB_NAME = generated;
  return generated;
}

export function getE2eDatabaseUrl(
  databaseName = getOrCreateE2eDatabaseName(),
): string {
  const url = new URL(getE2eAdminDatabaseUrl());
  url.pathname = `/${databaseName}`;
  return url.toString();
}

export function getE2eUrls() {
  const clientUrl = process.env.CLIENT_E2E_URL ?? DEFAULT_CLIENT_URL;
  const serverUrl = process.env.SERVER_E2E_URL ?? DEFAULT_SERVER_URL;
  const clientPort = new URL(clientUrl).port || "80";
  const serverPort = new URL(serverUrl).port || "80";

  return {
    clientUrl,
    serverUrl,
    clientPort,
    serverPort,
    clientHealthUrl: `http://[::1]:${clientPort}`,
    serverHealthUrl: `http://[::1]:${serverPort}`,
  };
}

export function createExampleServerE2eEnv(): Record<string, string> {
  const { clientUrl, serverUrl, serverPort } = getE2eUrls();

  return {
    DB_URL: "",
    NODE_OPTIONS: "",
    VITEST_WORKER_ID: "",
    NODE_ENV: "testing",
    DATABASE_URL: getE2eDatabaseUrl(),
    REDIS_URL:
      process.env.SERVER_E2E_REDIS_URL ??
      process.env.REDIS_URL ??
      DEFAULT_REDIS_URL,
    APP_URL: clientUrl,
    AUTH_URL: serverUrl,
    APP_SECRET: getOrCreateEnvSecret("PLAYWRIGHT_E2E_APP_SECRET"),
    AUTH_SECRET: getOrCreateEnvSecret("PLAYWRIGHT_E2E_AUTH_SECRET"),
    AUTH_EMAIL_REQUIRE_VERIFICATION: "true",
    AUTH_GITHUB_ENABLED: "true",
    AUTH_GITHUB_CLIENT_ID: "github-client-id",
    AUTH_GITHUB_CLIENT_SECRET: "github-client-secret",
    AUTH_OIDC_ENABLED: "false",
    SMTP_URL: process.env.SERVER_E2E_SMTP_URL ?? DEFAULT_SMTP_URL,
    SMTP_FROM: "Nest Boot Example <no-reply@example.com>",
    PORT: serverPort,
  };
}
