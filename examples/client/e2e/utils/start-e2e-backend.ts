import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import type { ChildProcess } from "node:child_process";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(currentDir, "../../../server");

function resolveDefaultAdminDatabaseUrl(): string {
  const url = new URL("postgresql://127.0.0.1:35432/postgres");
  url.username = process.env.POSTGRES_USER ?? "postgres";
  url.password = process.env.POSTGRES_PASSWORD ?? "secret";
  return url.toString();
}

const adminDatabaseUrl =
  process.env.SERVER_E2E_DATABASE_URL ?? resolveDefaultAdminDatabaseUrl();
const port = process.env.PORT ?? "4100";
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3100";
const authUrl = process.env.AUTH_URL ?? `http://127.0.0.1:${port}`;
const skipBuild =
  process.env.E2E_SKIP_BUILD === "1" || process.env.E2E_SKIP_BUILD === "true";
const administratorEmail =
  process.env.E2E_ADMIN_EMAIL ?? "e2e-administrator@example.com";
const administratorPassword =
  process.env.E2E_ADMIN_PASSWORD ?? "e2e-administrator-password";
const appSecret = randomBytes(32).toString("base64url");
const authSecret = randomBytes(32).toString("base64url");
const databaseName = `nest_boot_example_e2e_${process.pid}_${Date.now()}`;
const databaseUrl = (() => {
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
})();

let databaseCreated = false;
let serverProcess: ChildProcess | undefined;
let workerProcess: ChildProcess | undefined;
let shuttingDown = false;

process.on("SIGINT", () => {
  void cleanup(0);
});
process.on("SIGTERM", () => {
  void cleanup(0);
});

function createServerEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };

  delete env.DB_URL;
  delete env.QUEUE_DATABASE_URL;
  delete env.NODE_OPTIONS;
  delete env.VITEST_WORKER_ID;

  env.NODE_ENV = "testing";
  env.DATABASE_URL = databaseUrl;
  env.MIKRO_ORM_MIGRATIONS_SNAPSHOT_ON_MIGRATE = "false";
  env.REDIS_URL =
    process.env.SERVER_E2E_REDIS_URL ??
    process.env.REDIS_URL ??
    "redis://127.0.0.1:36379/0";
  env.APP_URL = appUrl;
  env.AUTH_URL = authUrl;
  env.APP_SECRET = appSecret;
  env.AUTH_SECRET = authSecret;
  env.AUTH_EMAIL_REQUIRE_VERIFICATION = "true";
  env.AUTH_GITHUB_ENABLED = "true";
  env.AUTH_GITHUB_CLIENT_ID = "github-client-id";
  env.AUTH_GITHUB_CLIENT_SECRET = "github-client-secret";
  env.AUTH_OIDC_ENABLED = "false";
  env.SMTP_URL = process.env.SERVER_E2E_SMTP_URL ?? "smtp://127.0.0.1:31025";
  env.SMTP_FROM = "Nest Boot Example <no-reply@example.com>";
  env.PORT = port;

  return env;
}

async function withPgClient<T>(
  connectionString: string,
  callback: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
  });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function createDatabase(): Promise<void> {
  await withPgClient(adminDatabaseUrl, async (client) => {
    await client.query(
      `CREATE DATABASE "${databaseName}" WITH ENCODING 'UTF8'`,
    );
  });
  databaseCreated = true;
}

async function dropDatabase(): Promise<void> {
  if (!databaseCreated) {
    return;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out dropping E2E database ${databaseName}`));
    }, 15_000);
    timeoutHandle.unref();
  });

  try {
    await Promise.race([
      withPgClient(adminDatabaseUrl, async (client) => {
        await client.query(
          `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
        );
      }),
      deadline,
    ]);
    databaseCreated = false;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function waitForServer(): Promise<void> {
  const timeoutAt = Date.now() + 30_000;
  let lastError: unknown;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(`${authUrl}/api/auth/ok`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    if (
      serverProcess &&
      (serverProcess.exitCode !== null || serverProcess.signalCode !== null)
    ) {
      throw new Error("Server exited before becoming ready");
    }

    await new Promise((resolveRetry) => setTimeout(resolveRetry, 250));
  }

  throw new Error(`Server did not become ready: ${String(lastError)}`);
}

async function seedAdministrator(): Promise<void> {
  const response = await fetch(`${authUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: appUrl,
    },
    body: JSON.stringify({
      email: administratorEmail,
      name: "E2E Administrator",
      password: administratorPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create the E2E administrator: ${response.status} ${await response.text()}`,
    );
  }

  await withPgClient(databaseUrl, async (client) => {
    await client.query(
      `update "user" set roles = array['admin'], email_verified = true where email = $1`,
      [administratorEmail],
    );
    const { rows } = await client.query<{
      email_verified: boolean;
      roles: Array<string> | null;
    }>(`select email_verified, roles from "user" where email = $1`, [
      administratorEmail,
    ]);
    const administrator = rows[0];
    if (
      !administrator?.email_verified ||
      !administrator.roles?.includes("admin")
    ) {
      throw new Error("Could not promote the E2E administrator");
    }
  });
}

async function cleanup(exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of [workerProcess, serverProcess]) {
    if (child && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolveExit) => {
        child.once("exit", () => resolveExit());
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
          }
        }, 5_000).unref();
      });
    }
  }

  await dropDatabase().catch((error: unknown) => {
    console.error(error);
  });
  process.exit(exitCode);
}

try {
  if (!skipBuild) {
    execFileSync("pnpm", ["build"], {
      cwd: serverRoot,
      stdio: ["ignore", "inherit", "inherit"],
    });
  }

  const serverEnv = createServerEnv();
  await createDatabase();

  execFileSync(
    process.execPath,
    ["dist/cli.js", "database", "migration", "up"],
    {
      cwd: serverRoot,
      env: serverEnv,
      stdio: ["ignore", "inherit", "inherit"],
    },
  );

  serverProcess = spawn(process.execPath, ["dist/main.js"], {
    cwd: serverRoot,
    env: serverEnv,
    stdio: ["ignore", "inherit", "inherit"],
  });
  serverProcess.once("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`E2E server exited unexpectedly: ${signal ?? code}`);
      void cleanup(1);
    }
  });

  const workerReady = new Promise<void>((resolveWorker, rejectWorker) => {
    let output = "";
    const child = spawn(process.execPath, ["dist/cli.js", "queue", "start"], {
      cwd: serverRoot,
      env: serverEnv,
      stdio: ["ignore", "pipe", "inherit"],
    });
    workerProcess = child;

    const timer = setTimeout(() => {
      rejectWorker(new Error("Timed out waiting for E2E queue worker startup"));
    }, 30_000);
    timer.unref();

    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      output += chunk.toString("utf8");
      if (output.includes("Queue workers running:")) {
        clearTimeout(timer);
        resolveWorker();
      }
    });

    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (!shuttingDown) {
        rejectWorker(
          new Error(`E2E worker exited unexpectedly: ${signal ?? code}`),
        );
        console.error(`E2E worker exited unexpectedly: ${signal ?? code}`);
        void cleanup(1);
      }
    });
  });

  await Promise.all([waitForServer(), workerReady]);
  await seedAdministrator();
  process.stdout.write(
    `Example E2E backend ready ${databaseName} ${authUrl}\n`,
  );
} catch (error) {
  console.error(error);
  await cleanup(1);
}
