import { mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { type EntityManager, EntitySchema } from "@mikro-orm/core";
import { MikroORM, PgliteDriver } from "@mikro-orm/pglite";
import { Seeder } from "@mikro-orm/seeder";
import { CommandFactory, CommandModule } from "@nest-boot/command";
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../dist/database.module.js";

class CommandRecord {
  id!: number;
  name!: string;
}
class AddedRecord {
  id!: number;
}
class TenantRecord {
  id!: number;
  name!: string;
}
const record = new EntitySchema({
  class: CommandRecord,
  properties: {
    id: { type: "integer", primary: true },
    name: { type: "string" },
  },
});
const added = new EntitySchema({
  class: AddedRecord,
  properties: { id: { type: "integer", primary: true } },
});
const tenant = new EntitySchema({
  class: TenantRecord,
  schema: "*",
  properties: {
    id: { type: "integer", primary: true },
    name: { type: "string" },
  },
});

class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await em.insert(CommandRecord, { name: "default" });
  }
}
class ConfiguredSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await em.insert(CommandRecord, { name: "configured" });
  }
}
class AlternateSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await em.insert(CommandRecord, { name: "alternate" });
  }
}

interface FixtureOptions {
  defaultSeeder?: string;
  seedersFromFiles?: boolean;
  includeTenantEntity?: boolean;
}

/**
 * Creates a persistent PGlite database shared only by commands in one test.
 * @param options - Seeder configuration and optional wildcard-schema entity.
 * @returns Command runner, database inspection helpers, and cleanup.
 */
export async function databaseCommandFixture(options: FixtureOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), "nb-database-"));
  await symlink(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules"),
    join(directory, "node_modules"),
    "dir",
  );
  const dbName = join(directory, "data");
  const migrations = join(directory, "migrations");
  const seeders = join(directory, "seeders");
  await mkdir(migrations);
  await mkdir(seeders);
  let featureEnabled = false;
  @Module({
    imports: [
      CommandModule,
      DatabaseModule.forRoot({
        driver: PgliteDriver,
        dbName,
        entities: [record, ...(options.includeTenantEntity ? [tenant] : [])],
        migrations: { path: migrations, pathTs: migrations, emit: "js" },
        seeder: {
          path: seeders,
          pathTs: seeders,
          emit: "ts",
          ...(options.seedersFromFiles
            ? {}
            : {
                seedersList: [
                  DatabaseSeeder,
                  ConfiguredSeeder,
                  AlternateSeeder,
                ],
              }),
          ...(options.defaultSeeder
            ? { defaultSeeder: options.defaultSeeder }
            : {}),
        },
      }),
      DatabaseModule.forFeatureAsync({
        useFactory: () => (featureEnabled ? [added] : []),
      }),
    ],
  })
  class AppModule {}

  /**
   * Executes the real command parser and captures its result.
   * @param args - Command path and CLI arguments.
   * @returns Exit status and captured output.
   */
  async function run(...args: string[]) {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    });
    const code = await CommandFactory.run(AppModule, {
      args,
      context: { stdout: stream, stderr: stream },
    });
    return { code, output };
  }

  /**
   * Executes a command expected to succeed, showing its output on failure.
   * @param args - Command path and CLI arguments.
   * @returns Captured command output.
   */
  async function succeed(...args: string[]) {
    const result = await run(...args);
    expect(result.code, result.output).toBe(0);
    return result.output;
  }

  /**
   * Reads persisted state through a separate ORM after the command app closes.
   * @param sql - SQL used to inspect or prepare database state.
   * @param params - Bound query parameters.
   * @returns Database rows returned by the query.
   */
  async function query<T extends object>(sql: string, params: unknown[] = []) {
    const orm = await MikroORM.init({ dbName, entities: [record] });
    try {
      return await orm.em.execute<T[]>(sql, params);
    } finally {
      await orm.close();
    }
  }

  return {
    directory,
    migrations,
    seeders,
    run,
    succeed,
    query,
    setFeatureEnabled: (enabled: boolean) => {
      featureEnabled = enabled;
    },
    hasTable: async (table: string, schema = "public") => {
      const rows = await query<{ present: boolean }>(
        "select to_regclass(?) is not null as present",
        [`${schema}.${table}`],
      );
      return rows[0].present;
    },
    records: () =>
      query<{ name: string }>("select name from command_record order by id"),
    migrationNames: async () =>
      (await readdir(migrations))
        .filter((name) => name.endsWith(".js"))
        .map((name) => name.replace(/\.js$/, ""))
        .sort(),
    generateMigration: async (name: string) => {
      await succeed("database:migration:create", "--name", name);
      const names = (await readdir(migrations)).filter((file) =>
        file.endsWith(`_${name}.js`),
      );
      expect(names).toHaveLength(1);
      return names[0].replace(/\.js$/, "");
    },
    close: () => rm(directory, { recursive: true, force: true }),
  };
}

export type DatabaseCommandFixture = Awaited<
  ReturnType<typeof databaseCommandFixture>
>;
