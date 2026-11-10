import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type DatabaseCommandFixture,
  databaseCommandFixture,
} from "../../test/fixtures/database-command.fixture.js";

describe("database seeder commands", { timeout: 30000 }, () => {
  let app: DatabaseCommandFixture;

  afterEach(async () => {
    process.exitCode = undefined;
    await app.close();
  });

  it.each([
    { defaultSeeder: undefined, expected: "default" },
    { defaultSeeder: "ConfiguredSeeder", expected: "configured" },
  ])(
    "runs the configured default ($expected)",
    async ({ defaultSeeder, expected }) => {
      app = await databaseCommandFixture({ defaultSeeder });
      await app.succeed("database:schema:create", "--run");
      await app.succeed("database:seeder:run");
      expect(await app.records()).toEqual([{ name: expected }]);
    },
  );

  it("--class selects a different seeder from the configured default", async () => {
    app = await databaseCommandFixture({
      defaultSeeder: "ConfiguredSeeder",
    });
    await app.succeed("database:schema:create", "--run");
    await app.succeed("database:seeder:run", "--class", "AlternateSeeder");
    expect(await app.records()).toEqual([{ name: "alternate" }]);
  });

  it("fails for an unknown seeder without changing data and closes the failed command", async () => {
    app = await databaseCommandFixture();
    await app.succeed("database:schema:create", "--run");
    await app.query("insert into command_record (name) values ('keep')");
    const failed = await app.run(
      "database:seeder:run",
      "--class",
      "MissingSeeder",
    );
    expect(failed.code).toBe(1);
    expect(failed.output).toContain("MissingSeeder not found");
    expect(await app.records()).toEqual([{ name: "keep" }]);
    await app.succeed("database:seeder:run");
    expect(await app.records()).toEqual([
      { name: "keep" },
      { name: "default" },
    ]);
  });

  it.each([
    { input: "database", className: "DatabaseSeeder", args: [] },
    {
      input: "demo-record",
      className: "DemoRecordSeeder",
      args: ["--class", "DemoRecordSeeder"],
    },
    {
      input: "DemoRecordSeeder",
      className: "DemoRecordSeeder",
      args: ["--class", "DemoRecordSeeder"],
    },
  ])(
    "creates and discovers a runnable seeder for $input",
    async ({ input, className, args }) => {
      app = await databaseCommandFixture({ seedersFromFiles: true });
      await app.succeed("database:schema:create", "--run");
      await app.query("insert into command_record (name) values ('keep')");
      await app.succeed("database:seeder:create", input);
      expect(await readdir(app.seeders)).toEqual([`${className}.ts`]);
      expect(
        await readFile(join(app.seeders, `${className}.ts`), "utf8"),
      ).toContain(`class ${className} extends Seeder`);
      await app.succeed("database:seeder:run", ...args);
      expect(await app.records()).toEqual([{ name: "keep" }]);
    },
  );
});
