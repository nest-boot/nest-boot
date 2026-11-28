import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import type { ChildProcess } from "node:child_process";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(currentDir, "../../../server");

function resolveDefaultAdminDatabaseUrl(): string {
  const url = new URL("postgresql://localhost:35432/postgres");
  url.username = encodeURIComponent(process.env.POSTGRES_USER ?? "postgres");
  url.password = encodeURIComponent(process.env.POSTGRES_PASSWORD ?? "secret");
  return url.toString();
}

const adminDatabaseUrl =
  process.env.SERVER_E2E_DATABASE_URL ?? resolveDefaultAdminDatabaseUrl();
const port = process.env.PORT ?? "4100";
const portNumber = Number(port);
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3100";
const authUrl = process.env.AUTH_URL ?? `http://127.0.0.1:${port}`;
const administratorEmail =
  process.env.E2E_ADMIN_EMAIL ?? "e2e-administrator@example.com";
const administratorPassword =
  process.env.E2E_ADMIN_PASSWORD ?? "e2e-administrator-password";
const appSecret = randomBytes(32).toString("base64url");
const authSecret = randomBytes(32).toString("base64url");
const databaseName = `nest_boot_example_e2e_${process.pid}_${Date.now()}_${randomBytes(4).toString("hex")}`;
const databaseUrl = (() => {
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
})();

let activeCreateClient: Client | undefined;
let createDatabasePromise: Promise<void> | undefined;
let creatorSession: { backendStart: string; pid: number } | undefined;
let databaseMayExist = false;
let migrationProcess: ChildProcess | undefined;
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

function probeTcpPort(targetPort: number, host: string): Promise<boolean> {
  return new Promise((resolveProbe) => {
    const socket = net.connect(targetPort, host);
    let done = false;
    const finish = (occupied: boolean) => {
      if (done) {
        return;
      }
      done = true;
      socket.destroy();
      resolveProbe(occupied);
    };
    socket.setTimeout(1_000, () => finish(false));
    socket.once("error", () => finish(false));
    socket.once("connect", () => finish(true));
  });
}

async function assertBackendPortAvailable(): Promise<void> {
  if (!Number.isInteger(portNumber) || portNumber <= 0 || portNumber > 65_535) {
    throw new Error(`Invalid E2E backend port: ${port}`);
  }

  const results = await Promise.all(
    ["127.0.0.1", "::1"].map((host) => probeTcpPort(portNumber, host)),
  );
  if (results.some(Boolean)) {
    throw new Error(
      `Local port ${port} is already in use; stop the existing process before running E2E tests.`,
    );
  }
}

function destroyPgSocket(client: Client): void {
  (
    client as unknown as {
      connection?: { stream?: { destroy: () => void } };
    }
  ).connection?.stream?.destroy();
}

async function closePgClient(client: Client, timeoutMs = 2_000): Promise<void> {
  if (timeoutMs <= 0) {
    destroyPgSocket(client);
    await client.end().catch(() => undefined);
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.end().catch(() => undefined),
      new Promise<void>((resolveTimeout) => {
        timer = setTimeout(() => {
          destroyPgSocket(client);
          resolveTimeout();
        }, timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function withPgClient<T>(
  connectionString: string,
  callback: (client: Client) => Promise<T>,
  options?: {
    deadlineMs?: number;
    onClientCreated?: (client: Client) => void;
  },
): Promise<T> {
  const deadlineMs = options?.deadlineMs ?? 15_000;
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5_000,
  });
  // Prevent background socket resets from crashing Node with an unhandled 'error' event.
  client.on("error", () => undefined);
  options?.onClientCreated?.(client);

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      destroyPgSocket(client);
      void client.end().catch(() => undefined);
      reject(
        new Error(
          `PostgreSQL operation timed out after ${String(deadlineMs)}ms`,
        ),
      );
    }, deadlineMs);
    timeoutHandle.unref();
  });

  try {
    return await Promise.race([
      (async () => {
        await client.connect();
        return await callback(client);
      })(),
      deadline,
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
    await closePgClient(client);
  }
}

function createDatabase(): Promise<void> {
  const pending = withPgClient(
    adminDatabaseUrl,
    async (client) => {
      const { rows } = await client.query<{
        backend_start: string;
        pid: number;
      }>(
        `
          select pid, backend_start::text as backend_start
          from pg_stat_activity
          where pid = pg_backend_pid()
        `,
      );
      const session = rows[0];
      if (!session) {
        throw new Error("Could not inspect PostgreSQL creator session");
      }
      const protocolPid = (client as unknown as { processID?: number | null })
        .processID;
      if (protocolPid !== session.pid) {
        throw new Error(
          "SERVER_E2E_DATABASE_URL must connect directly to PostgreSQL (not a connection pooler) so E2E database provisioning and cleanup can track the creator session.",
        );
      }
      creatorSession = {
        backendStart: session.backend_start,
        pid: session.pid,
      };
      databaseMayExist = true;
      await client.query("set statement_timeout = 15000");
      try {
        await client.query(
          `CREATE DATABASE "${databaseName}" WITH ENCODING 'UTF8'`,
        );
        creatorSession = undefined;
      } finally {
        await client.query("reset statement_timeout").catch(() => undefined);
      }
    },
    {
      deadlineMs: 20_000,
      onClientCreated: (client) => {
        activeCreateClient = client;
      },
    },
  ).finally(() => {
    activeCreateClient = undefined;
  });
  createDatabasePromise = pending;
  return pending;
}

async function waitForCreatorSessionToExit(client: Client): Promise<void> {
  if (!creatorSession) {
    return;
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { rowCount } = await client.query(
      `
        select pg_terminate_backend(pid)
        from pg_stat_activity
        where pid = $1
          and backend_start::text = $2
          and pid <> pg_backend_pid()
      `,
      [creatorSession.pid, creatorSession.backendStart],
    );
    if (!rowCount) {
      creatorSession = undefined;
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(
    `Creator backend PID ${String(creatorSession.pid)} for ${databaseName} did not exit in time`,
  );
}

async function dropDatabase(): Promise<void> {
  if (createDatabasePromise) {
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        createDatabasePromise.catch(() => undefined),
        new Promise<void>((resolveGrace) => {
          graceTimer = setTimeout(() => {
            if (activeCreateClient) {
              void closePgClient(activeCreateClient, 0);
            }
            resolveGrace();
          }, 5_000);
          graceTimer.unref();
        }),
      ]);
    } finally {
      if (graceTimer !== undefined) {
        clearTimeout(graceTimer);
      }
    }
    await createDatabasePromise.catch(() => undefined);
  }
  if (!databaseMayExist) {
    return;
  }

  await withPgClient(
    adminDatabaseUrl,
    async (client) => {
      await waitForCreatorSessionToExit(client);
      await client.query(
        `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
      );
    },
    {
      deadlineMs: 15_000,
    },
  );
  databaseMayExist = false;
}

async function runMigrations(serverEnv: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolveMigration, rejectMigration) => {
    const child = spawn(
      process.execPath,
      ["dist/cli.js", "database", "migration", "up"],
      {
        cwd: serverRoot,
        env: serverEnv,
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    migrationProcess = child;

    child.once("error", (error) => {
      migrationProcess = undefined;
      rejectMigration(error);
    });
    child.once("exit", (code, signal) => {
      migrationProcess = undefined;
      if (code === 0) {
        resolveMigration();
        return;
      }
      rejectMigration(
        new Error(`E2E database migration failed: ${signal ?? code}`),
      );
    });
  });
}

function assertServerAlive(): void {
  if (
    !serverProcess ||
    serverProcess.exitCode !== null ||
    serverProcess.signalCode !== null
  ) {
    throw new Error("Server exited before becoming ready");
  }
}

async function waitForServer(): Promise<void> {
  const timeoutAt = Date.now() + 30_000;
  let lastError: unknown;

  while (Date.now() < timeoutAt && !shuttingDown) {
    assertServerAlive();
    try {
      const response = await fetch(`${authUrl}/api/auth/ok`, {
        signal: AbortSignal.timeout(2_000),
      });
      assertServerAlive();
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    assertServerAlive();
    await new Promise((resolveRetry) => setTimeout(resolveRetry, 250));
  }

  throw new Error(`Server did not become ready: ${String(lastError)}`);
}

async function seedAdministrator(): Promise<void> {
  assertServerAlive();
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
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create the E2E administrator: ${response.status} ${await response.text()}`,
    );
  }

  await withPgClient(
    databaseUrl,
    async (client) => {
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
    },
    { deadlineMs: 15_000 },
  );
}

async function stopChildProcess(
  child: ChildProcess | undefined,
): Promise<void> {
  if (
    !child ||
    child.pid === undefined ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  await new Promise<void>((resolveExit) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 5_000);
    timer.unref();

    child.once("exit", () => {
      clearTimeout(timer);
      resolveExit();
    });
    child.kill("SIGTERM");
  });
}

async function cleanup(exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of [migrationProcess, workerProcess, serverProcess]) {
    await stopChildProcess(child);
  }

  await dropDatabase().catch((error: unknown) => {
    console.error(error);
  });
  process.exit(exitCode);
}

async function start(): Promise<void> {
  await assertBackendPortAvailable();
  if (shuttingDown) {
    return;
  }

  const serverEnv = createServerEnv();
  await createDatabase();
  if (shuttingDown) {
    return;
  }

  await runMigrations(serverEnv);
  if (shuttingDown) {
    return;
  }

  const serverReadyForExit = new Promise<never>((_, rejectServer) => {
    const child = spawn(process.execPath, ["dist/main.js"], {
      cwd: serverRoot,
      env: serverEnv,
      stdio: ["ignore", "inherit", "inherit"],
    });
    serverProcess = child;

    child.once("error", (error) => {
      rejectServer(error);
      if (!shuttingDown) {
        console.error("E2E server process error:", error);
        void cleanup(1);
      }
    });
    child.once("exit", (code, signal) => {
      rejectServer(
        new Error(`E2E server exited unexpectedly: ${signal ?? code}`),
      );
      if (!shuttingDown) {
        console.error(`E2E server exited unexpectedly: ${signal ?? code}`);
        void cleanup(1);
      }
    });
  });
  serverReadyForExit.catch(() => undefined);

  const READY_MARKER = "Queue workers running:";
  const workerReady = new Promise<void>((resolveWorker, rejectWorker) => {
    let settled = false;
    let startupTail = "";
    const child = spawn(process.execPath, ["dist/cli.js", "queue", "start"], {
      cwd: serverRoot,
      env: serverEnv,
      stdio: ["ignore", "pipe", "inherit"],
    });
    workerProcess = child;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        startupTail = "";
        rejectWorker(
          new Error("Timed out waiting for E2E queue worker startup"),
        );
      }
    }, 30_000);
    timer.unref();

    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      if (settled) {
        return;
      }
      startupTail += chunk.toString("utf8");
      if (startupTail.includes(READY_MARKER)) {
        settled = true;
        startupTail = "";
        clearTimeout(timer);
        resolveWorker();
        return;
      }
      if (startupTail.length > 1_024) {
        startupTail = startupTail.slice(-READY_MARKER.length);
      }
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        startupTail = "";
        rejectWorker(error);
      }
      if (!shuttingDown) {
        console.error("E2E worker process error:", error);
        void cleanup(1);
      }
    });

    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        startupTail = "";
        rejectWorker(
          new Error(`E2E worker exited unexpectedly: ${signal ?? code}`),
        );
      }
      if (!shuttingDown) {
        console.error(`E2E worker exited unexpectedly: ${signal ?? code}`);
        void cleanup(1);
      }
    });
  });

  await Promise.race([
    Promise.all([waitForServer(), workerReady]),
    serverReadyForExit,
  ]);
  if (shuttingDown) {
    return;
  }

  await Promise.race([seedAdministrator(), serverReadyForExit]);
  if (shuttingDown) {
    return;
  }

  process.stdout.write(
    `Example E2E backend ready ${databaseName} ${authUrl}\n`,
  );
}

start().catch(async (error: unknown) => {
  if (!shuttingDown) {
    console.error(error);
    await cleanup(1);
  }
});
