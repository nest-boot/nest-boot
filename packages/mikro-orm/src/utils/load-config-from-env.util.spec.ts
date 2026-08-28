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

interface TlsFilePaths {
  clientCert: string;
  clientKey: string;
  rootCert: string;
}

async function withTlsFiles(
  callback: (paths: TlsFilePaths) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "nest-boot-mikro-orm-"));
  const paths = {
    clientCert: join(directory, "client.crt"),
    clientKey: join(directory, "client.key"),
    rootCert: join(directory, "root.crt"),
  };

  try {
    await Promise.all([
      writeFile(paths.rootCert, "root certificate"),
      writeFile(paths.clientCert, "client certificate"),
      writeFile(paths.clientKey, "client key"),
    ]);
    await callback(paths);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

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

  it("should load the postgres PostgreSQL URI form", async () => {
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
    ["mysql", "ssl-mode=DISABLED", { ssl: false }],
    ["mysql", "ssl-mode=REQUIRED", { ssl: { rejectUnauthorized: false } }],
    ["postgresql", "sslmode=disable", { ssl: false }],
    ["postgresql", "sslmode=require", { ssl: { rejectUnauthorized: false } }],
    ["postgresql", "sslmode=verify-full", { ssl: {} }],
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

  it("should preserve omitted URL credentials and port", async () => {
    process.env.DATABASE_URL = "postgresql://db.internal";

    const config = await loadConfigFromEnv();

    expect(config).toMatchObject({
      dbName: undefined,
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
    await withTlsFiles(async ({ clientCert, clientKey, rootCert }) => {
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
    });
  });

  it.each(["require", "verify-ca"])(
    "should map PostgreSQL sslmode=%s with a root certificate",
    async (sslMode) => {
      await withTlsFiles(async ({ rootCert }) => {
        const databaseUrl = new URL("postgresql://user:pass@localhost/app");
        databaseUrl.searchParams.set("sslmode", sslMode);
        databaseUrl.searchParams.set("sslrootcert", rootCert);
        process.env.DATABASE_URL = databaseUrl.href;

        const config = await loadConfigFromEnv();
        const connection = config.driverOptions?.connection as Record<
          string,
          unknown
        >;
        const ssl = connection.ssl as Record<string, unknown>;

        expect(ssl).toMatchObject({
          ca: "root certificate",
          checkServerIdentity: expect.any(Function),
        });
        const checkServerIdentity = ssl.checkServerIdentity as () => undefined;

        checkServerIdentity();
      });
    },
  );

  it("should load MySQL TLS files into structured SSL options", async () => {
    await withTlsFiles(async ({ clientCert, clientKey, rootCert }) => {
      const databaseUrl = new URL("mysql://user:pass@localhost/app");
      databaseUrl.searchParams.set("ssl-ca", rootCert);
      databaseUrl.searchParams.set("ssl-cert", clientCert);
      databaseUrl.searchParams.set("ssl-key", clientKey);
      process.env.DATABASE_URL = databaseUrl.href;

      const config = await loadConfigFromEnv();

      expect(config.driverOptions).toEqual({
        connection: {
          ssl: {
            ca: "root certificate",
            cert: "client certificate",
            key: "client key",
            rejectUnauthorized: true,
            verifyIdentity: false,
          },
        },
      });
    });
  });

  it.each([
    ["VERIFY_CA", false],
    ["VERIFY_IDENTITY", true],
  ])(
    "should map MySQL ssl-mode=%s with a CA certificate",
    async (sslMode, verifyIdentity) => {
      await withTlsFiles(async ({ rootCert }) => {
        const databaseUrl = new URL("mysql://user:pass@localhost/app");
        databaseUrl.searchParams.set("ssl-mode", sslMode);
        databaseUrl.searchParams.set("ssl-ca", rootCert);
        process.env.DATABASE_URL = databaseUrl.href;

        await expect(loadConfigFromEnv()).resolves.toMatchObject({
          driverOptions: {
            connection: {
              ssl: {
                ca: "root certificate",
                rejectUnauthorized: true,
                verifyIdentity,
              },
            },
          },
        });
      });
    },
  );

  it("should not read MySQL TLS files when SSL is disabled", async () => {
    process.env.DATABASE_URL =
      "mysql://user:pass@localhost/app?ssl-mode=DISABLED&ssl-ca=/missing/ca.pem";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      driverOptions: {
        connection: {
          ssl: false,
        },
      },
    });
  });

  it("should reject unsupported MySQL SSL modes", async () => {
    process.env.DATABASE_URL =
      "mysql://user:pass@localhost/app?ssl-mode=VERIFY_HOSTNAME";

    await expect(loadConfigFromEnv()).rejects.toThrow(
      "Unsupported MySQL ssl-mode: VERIFY_HOSTNAME",
    );
  });

  it.each([
    ["mysql://user:pass@localhost/app?ssl-mode=PREFERRED", "PREFERRED"],
    ["postgresql://user:pass@localhost/app?sslmode=allow", "allow"],
    ["postgresql://user:pass@localhost/app?sslmode=prefer", "prefer"],
  ])(
    "should reject SSL fallback mode %s that structured options cannot express",
    async (databaseUrl, sslMode) => {
      process.env.DATABASE_URL = databaseUrl;

      await expect(loadConfigFromEnv()).rejects.toThrow(
        `Unsupported ${databaseUrl.startsWith("mysql:") ? "MySQL ssl-mode" : "PostgreSQL sslmode"}: ${sslMode}`,
      );
    },
  );

  it.each(["VERIFY_CA", "VERIFY_IDENTITY"])(
    "should require ssl-ca for MySQL ssl-mode=%s",
    async (sslMode) => {
      process.env.DATABASE_URL = `mysql://user:pass@localhost/app?ssl-mode=${sslMode}`;

      await expect(loadConfigFromEnv()).rejects.toThrow(
        `MySQL ssl-mode=${sslMode} requires ssl-ca`,
      );
    },
  );

  it("should require sslrootcert for PostgreSQL verify-ca", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@localhost/app?sslmode=verify-ca";

    await expect(loadConfigFromEnv()).rejects.toThrow(
      "PostgreSQL sslmode=verify-ca requires sslrootcert",
    );
  });

  it.each([
    [
      "mysql://user:pass@localhost/app?ssl=true",
      "Unsupported MySQL DATABASE_URL parameter: ssl",
    ],
    [
      "mysql://user:pass@localhost/app?multipleStatements=false",
      "Unsupported MySQL DATABASE_URL parameter: multipleStatements",
    ],
    [
      "postgresql://user:pass@localhost/app?ssl=true",
      "Unsupported PostgreSQL DATABASE_URL parameter: ssl",
    ],
    [
      "postgresql://user:pass@localhost/app?ssl=1",
      "Unsupported PostgreSQL DATABASE_URL parameter: ssl",
    ],
    [
      "postgresql://user:pass@localhost/app?uselibpqcompat=true",
      "Unsupported PostgreSQL DATABASE_URL parameter: uselibpqcompat",
    ],
    [
      "postgresql://user:pass@localhost/app?sslmode=no-verify",
      "Unsupported PostgreSQL sslmode: no-verify",
    ],
  ])("should reject non-standard database URL options", async (url, error) => {
    process.env.DATABASE_URL = url;

    await expect(loadConfigFromEnv()).rejects.toThrow(error);
  });

  it.each(["mysql2://localhost/app", "sqlite:///var/lib/app.db"])(
    "should reject non-standard database URL %s",
    async (databaseUrl) => {
      process.env.DATABASE_URL = databaseUrl;

      await expect(loadConfigFromEnv()).rejects.toThrow(
        `Unsupported DATABASE_URL protocol: ${new URL(databaseUrl).protocol}`,
      );
    },
  );

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
