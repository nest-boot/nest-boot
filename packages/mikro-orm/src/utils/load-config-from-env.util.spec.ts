import { DataloaderType, type Options } from "@mikro-orm/core";
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

  it("should decode a URL-encoded Unix socket hostname", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@%2Fvar%2Frun%2Fpostgresql/app";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      dbName: "app",
      driver: PostgreSqlDriver,
      host: "/var/run/postgresql",
      password: "pass",
      user: "user",
    });
  });

  it.each([
    ["mysql", "ssl=true", { ssl: true }],
    ["mysql", "ssl=false", { ssl: false }],
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
