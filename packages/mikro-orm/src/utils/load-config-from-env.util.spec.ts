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
    process.env.DB_URL = "mysql://user:pass@localhost:3306/app";
    process.env.DB_DEBUG = "true";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      clientUrl: "mysql://user:pass@localhost:3306/app",
      colors: false,
      dataloader: DataloaderType.ALL,
      debug: true,
      driver: MySqlDriver,
      entities: ["dist/**/*.entity.js"],
      entitiesTs: ["src/**/*.entity.ts"],
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
      timezone: "UTC",
    });
  });

  it("should load URL-based PostgreSQL config", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/app";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      clientUrl: "postgresql://user:pass@localhost:5432/app",
      driver: PostgreSqlDriver,
    });
  });

  it("should load host-based config from aliases", async () => {
    process.env.DATABASE_TYPE = "postgres";
    process.env.DATABASE_HOST = "localhost";
    process.env.DATABASE_PORT = "5432";
    process.env.DATABASE_NAME = "app";
    process.env.DATABASE_USERNAME = "user";
    process.env.DATABASE_PASSWORD = "pass";

    await expect(loadConfigFromEnv()).resolves.toMatchObject({
      dbName: "app",
      driver: PostgreSqlDriver,
      host: "localhost",
      password: "pass",
      port: 5432,
      user: "user",
    });
  });

  it("should return undefined driver and port when env vars are absent", async () => {
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
