import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BetterSqliteDriver } from "@mikro-orm/better-sqlite";
import { Configuration, DataloaderType, type Options } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

import { loadConfigFromEnv } from "./load-config-from-env.util";

const ORIGINAL_ENV = process.env;

describe("loadConfigFromEnv", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should load URL-based MySQL config", async () => {
    process.env.DATABASE_URL =
      "mysql://user%40example.com:p%40ss%2Fword@localhost:3306/app";

    const config = await loadConfigFromEnv();

    expect(config).toMatchObject({
      colors: false,
      dataloader: DataloaderType.ALL,
      dbName: "app",
      debug: false,
      driver: MySqlDriver,
      entities: ["dist/**/*.entity.js"],
      entitiesTs: ["src/**/*.entity.ts"],
      host: "localhost",
      metadataProvider: TsMorphMetadataProvider,
      migrations: {
        path: "dist/database/migrations",
        pathTs: "src/database/migrations",
        snapshot: false,
      },
      seeder: {
        defaultSeeder: "DatabaseSeeder",
        path: "dist/database/seeders",
        pathTs: "src/database/seeders",
      },
      password: "p@ss/word",
      port: 3306,
      timezone: "UTC",
      user: "user@example.com",
    });
    expect(config).not.toHaveProperty("clientUrl");
    expect((config as Options).seeder?.fileName?.("CustomSeeder")).toBe(
      "CustomSeeder",
    );
  });

  it("should load URL-based PostgreSQL config", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@[2001:db8::1]:5432/app?schema=tenant&sslmode=require&application_name=nest-boot";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      dbName: "app",
      driver: PostgreSqlDriver,
      driverOptions: {
        connection: {
          application_name: "nest-boot",
          ssl: {},
        },
      },
      host: "2001:db8::1",
      password: "pass",
      port: 5432,
      schema: "tenant",
      user: "user",
    });
  });

  it("should support the postgres protocol alias", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost/app";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      dbName: "app",
      driver: PostgreSqlDriver,
      host: "localhost",
      password: "pass",
      user: "user",
    });
  });

  it("should load a file URL as SQLite config", async () => {
    process.env.DATABASE_URL = "file:///var/lib/nest-boot/app%20data.db";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      dbName: "/var/lib/nest-boot/app data.db",
      driver: BetterSqliteDriver,
    });
  });

  it.each([
    ["mysql", "ssl=true", { ssl: true }],
    ["mysql", "ssl=false", { ssl: false }],
    ["postgresql", "ssl=true", { ssl: true }],
    ["postgresql", "ssl=0", { ssl: false }],
    ["postgresql", "sslmode=disable", { ssl: false }],
    ["postgresql", "sslmode=no-verify", { ssl: { rejectUnauthorized: false } }],
  ])(
    "should parse %s driver query option %s",
    async (protocol, query, expected) => {
      process.env.DATABASE_URL = `${protocol}://user:pass@localhost/app?${query}`;

      await expect(loadConfigFromEnv()).resolves.toMatchObject({
        driverOptions: {
          connection: expected,
        },
      });
    },
  );

  it("should use mysql2-compatible query value coercion", async () => {
    process.env.DATABASE_URL =
      "mysql://user:pass@localhost/app?multipleStatements=false&compress=true&connectTimeout=1000&charset=utf8mb4";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      driverOptions: {
        connection: {
          charset: "utf8mb4",
          compress: true,
          connectTimeout: 1000,
          multipleStatements: false,
        },
      },
    });
  });

  it("should preserve omitted URL credentials and port", async () => {
    process.env.DATABASE_URL = "postgresql://db.internal/app";

    const config = await loadConfigFromEnv();

    expect(config).toMatchObject({
      host: "db.internal",
      password: "",
      port: 0,
      user: "",
    });

    const mikroOrmConfig = new Configuration(config as Options, false);

    expect(
      mikroOrmConfig.getDriver().getConnection().getConnectionOptions(),
    ).toMatchObject({
      host: "db.internal",
      password: "",
      port: 0,
      user: "",
    });
  });

  it("should load PostgreSQL TLS files into structured SSL options", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nest-boot-mikro-orm-"));
    const rootCert = join(directory, "root.crt");
    const clientCert = join(directory, "client.crt");
    const clientKey = join(directory, "client.key");

    try {
      await Promise.all([
        writeFile(rootCert, "root certificate"),
        writeFile(clientCert, "client certificate"),
        writeFile(clientKey, "client key"),
      ]);

      const databaseUrl = new URL("postgresql://user:pass@localhost/app");
      databaseUrl.searchParams.set("sslmode", "verify-full");
      databaseUrl.searchParams.set("sslrootcert", rootCert);
      databaseUrl.searchParams.set("sslcert", clientCert);
      databaseUrl.searchParams.set("sslkey", clientKey);
      process.env.DATABASE_URL = databaseUrl.href;

      await expect(loadConfigFromEnv()).resolves.toMatchObject({
        driverOptions: {
          connection: {
            ssl: {
              ca: "root certificate",
              cert: "client certificate",
              key: "client key",
            },
          },
        },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("should reject unsupported database URL protocols", async () => {
    process.env.DATABASE_URL = "mongodb://localhost/app";

    await expect(loadConfigFromEnv()).rejects.toThrow(
      "Unsupported DATABASE_URL protocol: mongodb:",
    );
  });

  it("should return undefined connection fields when DATABASE_URL is absent", async () => {
    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      dbName: undefined,
      driver: undefined,
      host: undefined,
      password: undefined,
      port: undefined,
      user: undefined,
    });
  });
});
