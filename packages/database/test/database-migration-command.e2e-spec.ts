import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type DatabaseCommandFixture,
  databaseCommandFixture,
} from "./fixtures/database-command.fixture.js";

describe("database migration commands", { timeout: 30000 }, () => {
  let app: DatabaseCommandFixture;

  beforeEach(async () => {
    app = await databaseCommandFixture();
  });

  afterEach(async () => {
    process.exitCode = undefined;
    await app.close();
  });

  it("generates a migration and SQL in the requested directory without creating entity tables", async () => {
    const directory = join(app.directory, "custom-migrations");
    const output = await app.succeed(
      "database:migration:create",
      "--name",
      "initial",
      "--path",
      directory,
      "--dump",
    );
    expect(output).toContain('create table "command_record"');
    const files = await readdir(directory);
    expect(files).toHaveLength(1);
    expect(await readFile(join(directory, files[0]), "utf8")).toContain(
      'create table "command_record"',
    );
    expect(await app.hasTable("command_record")).toBe(false);
  });

  it("tracks pending and executed migrations and avoids generating an empty migration", async () => {
    const migration = await app.generateMigration("initial");
    expect(await app.succeed("database:migration:list")).toBe(
      "No executed migrations.\n",
    );
    expect(await app.succeed("database:migration:pending")).toBe(
      `${migration}\n`,
    );
    await app.succeed("database:migration:up", "--from", "0");
    expect(await app.hasTable("command_record")).toBe(true);
    expect(await app.succeed("database:migration:list")).toMatch(
      new RegExp(`${migration}\\t\\d{4}-\\d{2}-\\d{2}T`),
    );
    expect(await app.succeed("database:migration:pending")).toBe(
      "No pending migrations.\n",
    );
    expect(await app.succeed("database:migration:up")).toBe(
      "Applied 0 migration(s).\n",
    );
    expect(await app.succeed("database:migration:create")).toBe(
      "Schema is up-to-date.\n",
    );
    expect(await app.migrationNames()).toEqual([migration]);
  });

  it("applies a named migration range and rolls back to zero", async () => {
    const first = await app.generateMigration("initial");
    app.setFeatureEnabled(true);
    const second = await app.generateMigration("optional");
    await app.succeed("database:migration:up", "--to", first);
    expect(await app.hasTable("command_record")).toBe(true);
    expect(await app.hasTable("added_record")).toBe(false);
    expect(await app.succeed("database:migration:pending")).toBe(`${second}\n`);
    await app.succeed(
      "database:migration:up",
      "--from",
      first,
      "--to",
      second,
      "--schema",
      "public",
    );
    expect(await app.hasTable("added_record")).toBe(true);
    await app.succeed("database:migration:down", "--to", "0");
    expect(await app.hasTable("command_record")).toBe(false);
    expect(await app.hasTable("added_record")).toBe(false);
    expect(await app.succeed("database:migration:list")).toBe(
      "No executed migrations.\n",
    );
  });

  it("parses a comma/space selection and rolls back only the selected migration", async () => {
    const first = await app.generateMigration("initial");
    app.setFeatureEnabled(true);
    const second = await app.generateMigration("optional");
    await app.succeed(
      "database:migration:up",
      "--only",
      `${first},  ${second}, `,
    );
    await app.query("insert into command_record (name) values ('keep')");
    expect(await app.hasTable("added_record")).toBe(true);
    await app.succeed("database:migration:down", "--only", second);
    expect(await app.hasTable("added_record")).toBe(false);
    expect(await app.records()).toEqual([{ name: "keep" }]);
    expect(await app.succeed("database:migration:pending")).toBe(`${second}\n`);
  });

  it.each(["--from", "--to"])(
    "rejects --only with %s before changing data or migration history",
    async (range) => {
      const migration = await app.generateMigration("initial");
      await app.succeed("database:migration:up");
      await app.query("insert into command_record (name) values ('keep')");
      const history = await app.succeed("database:migration:list");
      for (const command of [
        "database:migration:up",
        "database:migration:down",
      ]) {
        const result = await app.run(command, "--only", migration, range, "0");
        expect(result.code).toBe(1);
        expect(result.output).toContain("Use --only or --from/--to");
        expect(await app.records()).toEqual([{ name: "keep" }]);
        expect(await app.succeed("database:migration:list")).toBe(history);
      }
    },
  );

  it("returns a failing check for a new entity without changing existing data", async () => {
    await app.generateMigration("initial");
    await app.succeed("database:migration:up");
    await app.query("insert into command_record (name) values ('keep')");
    await app.succeed("database:migration:check");
    app.setFeatureEnabled(true);
    const result = await app.run("database:migration:check");
    expect(result.code).toBe(1);
    expect(result.output).toContain("Schema changes require a migration.");
    expect(await app.hasTable("added_record")).toBe(false);
    expect(await app.records()).toEqual([{ name: "keep" }]);
  });

  it.each([false, true])(
    "fresh reruns migration history and replaces existing data (seed: %s)",
    async (seed) => {
      const migration = await app.generateMigration("initial");
      await app.succeed("database:migration:up");
      await app.query("insert into command_record (name) values ('old')");
      await app.succeed(
        "database:migration:fresh",
        ...(seed ? ["--seed", "ConfiguredSeeder"] : []),
      );
      expect(await app.records()).toEqual(seed ? [{ name: "configured" }] : []);
      expect(await app.query("select name from mikro_orm_migrations")).toEqual([
        { name: migration },
      ]);
    },
  );
});
