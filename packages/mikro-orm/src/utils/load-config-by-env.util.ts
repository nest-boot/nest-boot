import { type Options } from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

const baseConfig: Options = {
  timezone: "UTC",
  metadataProvider: TsMorphMetadataProvider,
  entities: ["dist/**/*.entity.js"],
  entitiesTs: ["src/**/*.entity.ts"],
  migrations: {
    snapshot: false,
    path: "dist/database/migrations",
    pathTs: "src/database/migrations",
  },
  seeder: {
    path: "dist/database/seeders",
    pathTs: "src/database/seeders",
    defaultSeeder: "DatabaseSeeder",
    fileName: (className: string) => className,
  },
};

export function loadConfigByEnv():
  | { clientUrl?: string }
  | {
      host?: string;
      port?: number;
      dbName?: string;
      user?: string;
      password?: string;
    } {
  const dbUrl = process.env.DB_URL ?? process.env.DATABASE_URL;

  if (dbUrl) {
    return {
      ...baseConfig,
      clientUrl: dbUrl,
    };
  }

  const dbHost = process.env.DB_HOST ?? process.env.DATABASE_HOST;
  const dbPort = process.env.DB_PORT ?? process.env.DATABASE_PORT;
  const dbName =
    process.env.DB_NAME ?? process.env.DB_DATABASE ?? process.env.DATABASE_NAME;
  const dbUsername =
    process.env.DB_USER ??
    process.env.DB_USERNAME ??
    process.env.DATABASE_USER ??
    process.env.DATABASE_USERNAME;
  const dbPassword =
    process.env.DB_PASS ??
    process.env.DB_PASSWORD ??
    process.env.DATABASE_PASS ??
    process.env.DATABASE_PASSWORD;

  return {
    ...baseConfig,
    host: dbHost,
    port: dbPort ? +dbPort : undefined,
    dbName,
    user: dbUsername,
    password: dbPassword,
  };
}
