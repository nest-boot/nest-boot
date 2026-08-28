import { DataloaderType } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

import { loadConfigFromEnv } from "./load-config-from-env.util";

const ORIGINAL_ENV = process.env;

describe("loadConfigFromEnv", () => {
  beforeEach(() => {
    process.env = Object.fromEntries(
      Object.entries(ORIGINAL_ENV).filter(
        ([key]) => !key.startsWith("DB_") && !key.startsWith("DATABASE_"),
      ),
    );
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should load URL-based MySQL config", async () => {
    process.env.DB_URL =
      "mysql://user%40example.com:p%40ss%2Fword@localhost:3306/app";
    process.env.DB_DEBUG = "true";

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

  it("should ignore individual database variables", async () => {
    process.env.DB_TYPE = "mysql";
    process.env.DB_HOST = "ignored.local";
    process.env.DB_PORT = "3306";
    process.env.DB_NAME = "ignored";
    process.env.DB_DATABASE = "ignored-alias";
    process.env.DB_USER = "ignored-user";
    process.env.DB_USERNAME = "ignored-username";
    process.env.DB_PASS = "ignored-pass";
    process.env.DB_PASSWORD = "ignored-password";
    process.env.DATABASE_TYPE = "postgres";
    process.env.DATABASE_HOST = "localhost";
    process.env.DATABASE_PORT = "5432";
    process.env.DATABASE_NAME = "app";
    process.env.DATABASE_USERNAME = "user";
    process.env.DATABASE_PASSWORD = "pass";

    process.env.DATABASE_DEBUG = "false";

    const config = await loadConfigFromEnv();

    expect(config).toMatchObject({
      dbName: undefined,
      debug: false,
      driver: undefined,
      host: undefined,
      password: undefined,
      port: undefined,
      user: undefined,
    });
  });

  it("should return undefined connection fields when URL variables are absent", async () => {
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
