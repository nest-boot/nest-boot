import { mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { type EntityManager, EntitySchema } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import { Seeder } from "@mikro-orm/seeder";
import { CommandFactory, CommandModule } from "@nest-boot/command";
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database.module.js";

class CommandRecord {
  id!: number;
  name!: string;
}
class AddedRecord {
  id!: number;
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
class FixtureSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await em.insert(CommandRecord, { name: "Seeded" });
  }
}

/**
 * Creates an isolated persistent database and captures command output.
 * @param includeSeederList - Registers the in-process seeder fixture.
 * @returns Command runner and temporary database cleanup.
 */
async function fixture(includeSeederList = true) {
  const directory = await mkdtemp(join(tmpdir(), "nb-database-"));
  await symlink(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules"),
    join(directory, "node_modules"),
    "dir",
  );
  const migrations = join(directory, "migrations");
  const seeders = join(directory, "seeders");
  await mkdir(migrations);
  await mkdir(seeders);
  let includeAdded = false;
  @Module({
    imports: [
      CommandModule,
      DatabaseModule.forRoot({
        driver: PgliteDriver,
        dbName: join(directory, "data"),
        entities: [record],
        migrations: { path: migrations, pathTs: migrations, emit: "js" },
        seeder: {
          path: seeders,
          pathTs: seeders,
          emit: "js",
          ...(includeSeederList ? { seedersList: [FixtureSeeder] } : {}),
          defaultSeeder: "FixtureSeeder",
        },
      }),
      DatabaseModule.forFeatureAsync({
        useFactory: () => (includeAdded ? [added] : []),
      }),
    ],
  })
  class AppModule {}
  return {
    directory,
    seeders,
    addEntity: () => {
      includeAdded = true;
    },
    run: async (...args: string[]) => {
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
    },
    close: () => rm(directory, { recursive: true, force: true }),
  };
}

afterEach(() => {
  process.exitCode = undefined;
});

it("generates, applies, checks, reverts, and lists migrations using the module's ORM and feature entities", async () => {
  const app = await fixture();
  try {
    const generated = await app.run(
      "database:migration:create",
      "--name",
      "initial",
      "--dump",
    );
    expect(generated.code).toBe(0);
    expect(generated.output).toContain("Created Migration");
    expect(generated.output).toContain('create table "command_record"');
    const migrationName =
      (await readdir(join(app.directory, "migrations")))
        .find((name) => name.endsWith("_initial.js"))
        ?.replace(/\.js$/, "") ?? "";
    expect(migrationName).not.toBe("");
    expect((await app.run("database:migration:pending")).output).toContain(
      "initial",
    );
    const invalidRange = await app.run(
      "database:migration:up",
      "--only",
      migrationName,
      "--from",
      "0",
    );
    expect(invalidRange.code).toBe(1);
    expect(invalidRange.output).toContain("Use --only or --from/--to");
    expect((await app.run("database:migration:list")).output).toContain(
      "No executed migrations.",
    );
    expect(
      (
        await app.run(
          "database:migration:up",
          "--from",
          "0",
          "--to",
          migrationName,
          "--schema",
          "public",
        )
      ).output,
    ).toContain("Applied 1");
    expect((await app.run("database:migration:up")).output).toContain(
      "Applied 0",
    );
    expect((await app.run("database:migration:pending")).output).toContain(
      "No pending migrations.",
    );
    expect((await app.run("database:migration:create")).output).toContain(
      "Schema is up-to-date.",
    );
    expect(
      (await app.run("database:migration:down", "--only", migrationName))
        .output,
    ).toContain("Reverted 1");
    expect(
      (await app.run("database:migration:up", "--only", `${migrationName}, `))
        .output,
    ).toContain("Applied 1");
    expect((await app.run("database:migration:list")).output).toContain(
      "initial",
    );
    expect((await app.run("database:migration:check")).code).toBe(0);
    expect((await app.run("database:seeder:run")).output).toContain(
      "FixtureSeeder",
    );
    expect(
      await app.run("database:seeder:run", "--class", "FixtureSeeder"),
    ).toMatchObject({ code: 0, output: "Executed FixtureSeeder.\n" });
    app.addEntity();
    expect((await app.run("database:migration:check")).code).toBe(1);
    expect(
      (await app.run("database:schema:update", "--dump")).output,
    ).toContain("added_record");
    expect(
      (await app.run("database:migration:down", "--to", "0")).output,
    ).toContain("Reverted 1");
    expect((await app.run("database:migration:pending")).output).toContain(
      "initial",
    );
    expect(
      (await app.run("database:migration:fresh", "--seed", "FixtureSeeder"))
        .code,
    ).toBe(0);
  } finally {
    await app.close();
  }
}, 30000);

it("previews schema changes, executes explicit schema writes, and creates seeders", async () => {
  const app = await fixture();
  try {
    expect((await app.run("database:create")).code).toBe(0);
    expect((await app.run("database:schema:create")).output).toContain(
      "create table",
    );
    expect((await app.run("database:schema:create", "--run")).code).toBe(0);
    app.addEntity();
    expect(
      (
        await app.run(
          "database:schema:update",
          "--safe",
          "--no-drop-tables",
          "--run",
        )
      ).code,
    ).toBe(0);
    expect(
      (await app.run("database:schema:update", "--dump")).output,
    ).not.toContain("create table");
    expect((await app.run("database:schema:drop", "--dump")).output).toContain(
      "drop table",
    );
    expect((await app.run("database:schema:fresh")).code).toBe(1);
    expect(
      (
        await app.run(
          "database:schema:fresh",
          "--run",
          "--seed",
          "FixtureSeeder",
        )
      ).code,
    ).toBe(0);
    expect(
      (
        await app.run(
          "database:schema:drop",
          "--run",
          "--drop-migrations-table",
        )
      ).code,
    ).toBe(0);
  } finally {
    await app.close();
  }
}, 30000);

it("creates a seeder in the configured directory", async () => {
  const app = await fixture(false);
  try {
    expect(
      await app.run("database:seeder:create", "demo-record"),
    ).toMatchObject({ code: 0 });
    expect(await readdir(app.seeders)).toContain("DemoRecordSeeder.js");
  } finally {
    await app.close();
  }
}, 15000);
