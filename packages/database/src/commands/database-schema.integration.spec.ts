import {
  type DatabaseCommandFixture,
  databaseCommandFixture,
} from "../../test/fixtures/database-command.fixture.js";

describe("database schema commands", { timeout: 30000 }, () => {
  let app: DatabaseCommandFixture;
  const previews = [[], ["--dump"], ["--run", "--dump"]];

  beforeEach(async () => {
    app = await databaseCommandFixture();
  });

  afterEach(async () => {
    process.exitCode = undefined;
    await app.close();
  });

  it("creates the database idempotently and previews CREATE until --run is supplied", async () => {
    await app.succeed("database:create");
    await app.succeed("database:create");
    for (const args of previews) {
      expect(await app.succeed("database:schema:create", ...args)).toContain(
        'create table "command_record"',
      );
      expect(await app.hasTable("command_record")).toBe(false);
    }
    await app.succeed("database:schema:create", "--run");
    await app.query("insert into command_record (name) values ('created')");
    expect(await app.records()).toEqual([{ name: "created" }]);
  });

  it("previews UPDATE without applying the new entity and preserves existing rows when run", async () => {
    await app.succeed("database:schema:create", "--run");
    await app.query("insert into command_record (name) values ('keep')");
    app.setFeatureEnabled(true);
    for (const args of previews) {
      expect(await app.succeed("database:schema:update", ...args)).toContain(
        'create table "added_record"',
      );
      expect(await app.hasTable("added_record")).toBe(false);
      expect(await app.records()).toEqual([{ name: "keep" }]);
    }
    await app.succeed("database:schema:update", "--run");
    expect(await app.hasTable("added_record")).toBe(true);
    expect(await app.records()).toEqual([{ name: "keep" }]);
  });

  it.each(["--safe", "--no-drop-tables"])(
    "%s preserves an unmapped table and its data",
    async (option) => {
      app.setFeatureEnabled(true);
      await app.succeed("database:schema:create", "--run");
      await app.query("insert into added_record (id) values (42)");
      app.setFeatureEnabled(false);
      expect(await app.succeed("database:schema:update")).toContain(
        'drop table if exists "added_record"',
      );
      expect(await app.succeed("database:schema:update", option)).not.toContain(
        'drop table if exists "added_record"',
      );
      await app.succeed("database:schema:update", option, "--run");
      expect(await app.query("select id from added_record")).toEqual([
        { id: 42 },
      ]);
      await app.succeed("database:schema:update", "--run");
      expect(await app.hasTable("added_record")).toBe(false);
    },
  );

  it("previews DROP without removing tables or rows", async () => {
    await app.succeed("database:schema:create", "--run");
    await app.query("insert into command_record (name) values ('keep')");
    for (const args of previews) {
      expect(await app.succeed("database:schema:drop", ...args)).toContain(
        'drop table if exists "command_record"',
      );
      expect(await app.records()).toEqual([{ name: "keep" }]);
    }
    await app.succeed("database:schema:drop", "--run");
    expect(await app.hasTable("command_record")).toBe(false);
  });

  it("keeps migration history unless --drop-migrations-table is supplied", async () => {
    const migration = await app.generateMigration("initial");
    await app.succeed("database:migration:up");
    await app.succeed("database:schema:drop", "--run");
    expect(await app.hasTable("command_record")).toBe(false);
    expect(await app.query("select name from mikro_orm_migrations")).toEqual([
      { name: migration },
    ]);
    await app.succeed(
      "database:schema:drop",
      "--run",
      "--drop-migrations-table",
    );
    expect(await app.hasTable("mikro_orm_migrations")).toBe(false);
  });

  it.each([false, true])(
    "fresh requires --run and replaces old data (seed: %s)",
    async (seed) => {
      await app.succeed("database:schema:create", "--run");
      await app.query("insert into command_record (name) values ('old')");
      const rejected = await app.run("database:schema:fresh");
      expect(rejected.code).toBe(1);
      expect(rejected.output).toContain("requires --run");
      expect(await app.records()).toEqual([{ name: "old" }]);
      await app.succeed(
        "database:schema:fresh",
        "--run",
        ...(seed ? ["--seed", "AlternateSeeder"] : []),
      );
      expect(await app.records()).toEqual(seed ? [{ name: "alternate" }] : []);
    },
  );

  it("creates, refreshes, and drops only the requested schema", async () => {
    await app.close();
    app = await databaseCommandFixture({ includeTenantEntity: true });
    await app.succeed("database:schema:create", "--run");
    await app.query("insert into command_record (name) values ('public')");
    await app.succeed("database:schema:create", "--run", "--schema", "tenant");
    expect(await app.hasTable("tenant_record", "tenant")).toBe(true);
    await app.query("insert into tenant.tenant_record (name) values ('old')");
    await app.succeed("database:schema:fresh", "--run", "--schema", "tenant");
    expect(await app.query("select name from tenant.tenant_record")).toEqual(
      [],
    );
    expect(await app.records()).toEqual([{ name: "public" }]);
    await app.succeed("database:schema:drop", "--run", "--schema", "tenant");
    expect(await app.hasTable("tenant_record", "tenant")).toBe(false);
    expect(await app.records()).toEqual([{ name: "public" }]);
  });
});
