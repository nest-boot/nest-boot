import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Configuration, IDatabaseDriver, type Options } from "@mikro-orm/core";

import { loadDefaultConfig } from "./load-default-config.util";

/** Constructor type for a MikroORM database driver. */
export type DatabaseDriverConstructor = new (
  config: Configuration,
) => IDatabaseDriver;

async function getDriver(protocol: string): Promise<DatabaseDriverConstructor> {
  switch (protocol) {
    case "file:":
      return (await import("@mikro-orm/better-sqlite")).BetterSqliteDriver;
    case "mysql:":
      return (await import("@mikro-orm/mysql")).MySqlDriver;
    case "postgres:":
    case "postgresql:":
      return (await import("@mikro-orm/postgresql")).PostgreSqlDriver;
    default:
      throw new TypeError(`Unsupported DATABASE_URL protocol: ${protocol}`);
  }
}

function normalizeHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }

  return hostname;
}

async function loadTlsFiles(
  files: readonly (readonly [unknown, string])[],
): Promise<Record<string, unknown> | undefined> {
  const ssl: Record<string, unknown> = {};
  let hasTlsFile = false;

  for (const [path, sslKey] of files) {
    if (typeof path === "string" && path) {
      ssl[sslKey] = await readFile(path, "utf8");
      hasTlsFile = true;
    }
  }

  return hasTlsFile ? ssl : undefined;
}

async function loadPostgreSqlTlsFiles(
  connection: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const ssl = await loadTlsFiles([
    [connection.sslrootcert, "ca"],
    [connection.sslcert, "cert"],
    [connection.sslkey, "key"],
  ]);

  delete connection.sslrootcert;
  delete connection.sslcert;
  delete connection.sslkey;

  return ssl;
}

async function loadMySqlTlsConfig(
  connection: Record<string, unknown>,
): Promise<void> {
  const supportedParameters = ["ssl-mode", "ssl-ca", "ssl-cert", "ssl-key"];

  for (const parameter of Object.keys(connection)) {
    if (!supportedParameters.includes(parameter)) {
      throw new TypeError(
        `Unsupported MySQL DATABASE_URL parameter: ${parameter}`,
      );
    }
  }

  const sslMode = connection["ssl-mode"];
  const tlsFiles = [
    [connection["ssl-ca"], "ca"],
    [connection["ssl-cert"], "cert"],
    [connection["ssl-key"], "key"],
  ] as const;

  delete connection["ssl-ca"];
  delete connection["ssl-cert"];
  delete connection["ssl-key"];
  delete connection["ssl-mode"];

  const normalizedSslMode =
    typeof sslMode === "string" ? sslMode.toUpperCase() : sslMode;

  if (normalizedSslMode === "DISABLED") {
    connection.ssl = false;
    return;
  }

  if (normalizedSslMode === "PREFERRED") {
    throw new TypeError("Unsupported MySQL ssl-mode: PREFERRED");
  }

  const ssl = await loadTlsFiles(tlsFiles);

  switch (normalizedSslMode) {
    case "REQUIRED":
      connection.ssl = { ...ssl, rejectUnauthorized: false };
      break;
    case "VERIFY_CA":
      if (!ssl?.ca) {
        throw new TypeError("MySQL ssl-mode=VERIFY_CA requires ssl-ca");
      }
      connection.ssl = {
        ...ssl,
        rejectUnauthorized: true,
        verifyIdentity: false,
      };
      break;
    case "VERIFY_IDENTITY":
      if (!ssl?.ca) {
        throw new TypeError("MySQL ssl-mode=VERIFY_IDENTITY requires ssl-ca");
      }
      connection.ssl = {
        ...ssl,
        rejectUnauthorized: true,
        verifyIdentity: true,
      };
      break;
    case undefined:
      if (ssl) {
        connection.ssl = {
          ...ssl,
          rejectUnauthorized: true,
          verifyIdentity: false,
        };
      }
      break;
    default:
      throw new TypeError(`Unsupported MySQL ssl-mode: ${String(sslMode)}`);
  }
}

async function loadQueryConfig(
  url: URL,
  protocol: string,
): Promise<Pick<HostConfig, "driverOptions" | "schema">> {
  const connection: Record<string, unknown> = Object.fromEntries(
    url.searchParams,
  );

  const schema = url.searchParams.get("schema") ?? undefined;

  delete connection.schema;

  if (protocol === "mysql:") {
    await loadMySqlTlsConfig(connection);
  }

  if (protocol === "postgres:" || protocol === "postgresql:") {
    if (connection.ssl !== undefined) {
      throw new TypeError("Unsupported PostgreSQL DATABASE_URL parameter: ssl");
    }

    if (connection.uselibpqcompat !== undefined) {
      throw new TypeError(
        "Unsupported PostgreSQL DATABASE_URL parameter: uselibpqcompat",
      );
    }

    const sslMode = connection.sslmode;

    delete connection.uselibpqcompat;
    delete connection.sslmode;

    if (sslMode === "disable") {
      delete connection.sslrootcert;
      delete connection.sslcert;
      delete connection.sslkey;
      connection.ssl = false;
    } else if (sslMode === "allow" || sslMode === "prefer") {
      throw new TypeError(`Unsupported PostgreSQL sslmode: ${sslMode}`);
    } else {
      const tls = await loadPostgreSqlTlsFiles(connection);

      if (tls) {
        connection.ssl = tls;
      }

      switch (sslMode) {
        case "require":
          connection.ssl = tls?.ca
            ? { ...tls, checkServerIdentity: () => undefined }
            : { ...tls, rejectUnauthorized: false };
          break;
        case "verify-ca":
          if (!tls?.ca) {
            throw new TypeError(
              "PostgreSQL sslmode=verify-ca requires sslrootcert",
            );
          }
          connection.ssl = { ...tls, checkServerIdentity: () => undefined };
          break;
        case "verify-full":
          connection.ssl = tls ?? {};
          break;
        case undefined:
          break;
        default:
          throw new TypeError(
            `Unsupported PostgreSQL sslmode: ${String(sslMode)}`,
          );
      }
    }
  }

  return {
    schema,
    driverOptions: Object.keys(connection).length ? { connection } : undefined,
  };
}

/** Database driver configuration for MikroORM. */
export interface DriverConfig {
  /** Database driver class constructor. */
  driver?: DatabaseDriverConstructor;
}

/** URL-based database connection configuration for explicit module options. */
export interface UrlConfig {
  /** Database connection URL. */
  clientUrl?: string;
}

/** Host-based database connection configuration. */
export interface HostConfig {
  /** Database host. */
  host?: string;
  /** Database port. */
  port?: number;
  /** Database name. */
  dbName?: string;
  /** Database user. */
  user?: string;
  /** Database password. */
  password?: string;
  /** Default database schema. */
  schema?: string;
  /** Driver connection options parsed from URL query parameters. */
  driverOptions?: Options["driverOptions"];
}

/**
 * Loads MikroORM configuration from environment variables.
 *
 * @remarks
 * Supports `DATABASE_URL`, which is parsed into individual connection options,
 * including structured query options. The `postgresql:` and `postgres:`
 * protocols select PostgreSQL, `mysql:` selects MySQL, and `file:` selects
 * SQLite. Only the URL forms documented by those databases are accepted;
 * other protocol names and driver-specific compatibility forms are rejected.
 * PostgreSQL supports `sslmode=disable`, `require`, `verify-ca`, and
 * `verify-full`; MySQL supports `ssl-mode=DISABLED`, `REQUIRED`, `VERIFY_CA`,
 * and `VERIFY_IDENTITY`. Modes that require a plaintext fallback are rejected
 * because one structured driver configuration cannot preserve that behavior.
 *
 * @returns MikroORM options derived from environment variables
 */
export async function loadConfigFromEnv(): Promise<DriverConfig & HostConfig> {
  const baseConfig = loadDefaultConfig();

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const url = new URL(databaseUrl);
    const driver = await getDriver(url.protocol);

    if (url.protocol === "file:") {
      return {
        ...baseConfig,
        driver,
        dbName: fileURLToPath(url),
      };
    }

    const dbName = url.pathname.slice(1);

    return {
      ...baseConfig,
      driver,
      host: normalizeHostname(url.hostname),
      port: +url.port,
      dbName: dbName ? decodeURIComponent(dbName) : undefined,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ...(await loadQueryConfig(url, url.protocol)),
    };
  }

  return {
    ...baseConfig,
    driver: undefined,
    host: undefined,
    port: undefined,
    dbName: undefined,
    user: undefined,
    password: undefined,
  };
}
