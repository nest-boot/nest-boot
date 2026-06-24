import { EntitySchema } from '@mikro-orm/core';
import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adminDatabaseUrl =
  process.env.SERVER_E2E_DATABASE_URL ??
  'postgresql://postgres:secret@localhost:5432/postgres';
const port = process.env.PORT ?? '4100';
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:3100';
const authUrl = process.env.AUTH_URL ?? `http://127.0.0.1:${port}`;
const databaseName = `all_in_one_e2e_${process.pid}_${Date.now()}`;
const databaseUrl = databaseUrlFor(databaseName);
const graphqlRequireShim = join(
  serverRoot,
  'scripts/nestjs-graphql-require-shim.mjs',
);
let serverProcess;
let shuttingDown = false;

const DbProbeSchema = new EntitySchema({
  name: 'AllInOneE2eDbProbe',
  tableName: 'all_in_one_e2e_db_probe',
  properties: {
    id: {
      primary: true,
      type: 'number',
    },
  },
});

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

try {
  await createDatabase();
  await applyMigrations();
  serverProcess = spawn(
    process.execPath,
    ['--import', graphqlRequireShim, 'dist/main.js'],
    {
      cwd: serverRoot,
      env: createServerEnv(),
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  serverProcess.once('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`e2e server exited unexpectedly: ${signal ?? code}`);
      cleanup(1);
    }
  });

  await waitForServer();
  console.log(`all-in-one e2e server ready ${databaseName} ${authUrl}`);
} catch (error) {
  console.error(error);
  await cleanup(1);
}

async function applyMigrations() {
  const orm = await adminOrm(databaseUrl);

  try {
    const migrationsDir = join(serverRoot, 'dist/database/migrations');
    const migrationFiles = (await readdir(migrationsDir))
      .filter((file) => /^Migration.*\.js$/.test(file))
      .sort();

    if (migrationFiles.length === 0) {
      throw new Error(`No built migrations found in ${migrationsDir}`);
    }

    for (const file of migrationFiles) {
      const migrationModule = await import(
        pathToFileURL(join(migrationsDir, file)).href
      );
      const Migration = Object.values(migrationModule).find(
        (value) =>
          typeof value === 'function' && value.name.startsWith('Migration'),
      );

      if (!Migration) {
        throw new Error(`Migration class not found in ${file}`);
      }

      const migration = new Migration();
      const statements = [];

      migration.addSql = (statement) => {
        statements.push(statement);
      };

      await migration.up();

      for (const statement of statements) {
        await orm.em.getConnection().execute(statement);
      }
    }
  } finally {
    await orm.close(true);
  }
}

async function cleanup(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (serverProcess && serverProcess.exitCode === null) {
    await new Promise((resolveExit) => {
      serverProcess.once('exit', resolveExit);
      serverProcess.kill('SIGTERM');
      setTimeout(() => {
        if (serverProcess.exitCode === null) {
          serverProcess.kill('SIGKILL');
        }
      }, 5_000).unref();
    });
  }

  await dropDatabase().catch((error) => {
    console.error(error);
  });
  console.log(`all-in-one e2e server cleaned up ${databaseName}`);
  process.exit(exitCode);
}

async function createDatabase() {
  const orm = await adminOrm(adminDatabaseUrl);

  try {
    await orm.em
      .getConnection()
      .execute(`CREATE DATABASE "${databaseName}" WITH ENCODING 'UTF8'`);
  } finally {
    await orm.close(true);
  }
}

function createServerEnv() {
  const env = { ...process.env };

  delete env.DB_URL;
  delete env.NODE_OPTIONS;
  delete env.VITEST_WORKER_ID;
  env.NODE_ENV = 'testing';
  env.DATABASE_URL = databaseUrl;
  env.APP_URL = appUrl;
  env.AUTH_URL = authUrl;
  env.APP_SECRET = '1oAdy3zpD3S0t1AdAqPTlj4Hhkyx83pT2UlNGfS4P2c';
  env.AUTH_SECRET = 'R4vWrEDXeeor7VzGzQsdbQobOFtv2nRrlhOVTGpOteA';
  env.AUTH_OIDC_ID = 'all-in-one-e2e';
  env.AUTH_OIDC_SECRET = 'all-in-one-e2e-secret';
  env.AUTH_OIDC_DISCOVERY_URL =
    'https://auth.example.test/.well-known/openid-configuration';
  env.PORT = port;

  return env;
}

function databaseUrlFor(name) {
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${name}`;

  return url.toString();
}

async function dropDatabase() {
  const orm = await adminOrm(adminDatabaseUrl);

  try {
    await orm.em.getConnection().execute(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = ?;
      `,
      [databaseName],
    );
    await orm.em
      .getConnection()
      .execute(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await orm.close(true);
  }
}

function adminOrm(clientUrl) {
  return MikroORM.init({
    allowGlobalContext: true,
    clientUrl,
    driver: PostgreSqlDriver,
    entities: [DbProbeSchema],
  });
}

async function waitForServer() {
  const timeoutAt = Date.now() + 20_000;
  let lastError;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(`${authUrl}/api/auth/ok`);

      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      throw new Error('Server exited before becoming ready');
    }

    await new Promise((resolveRetry) => setTimeout(resolveRetry, 250));
  }

  throw new Error(`Server did not become ready: ${String(lastError)}`);
}
