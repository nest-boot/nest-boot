import { LATEST_SCHEMA_VERSION } from "bullmq";

import { runCli } from "./cli.fixture.js";
import { createPostgresFixture } from "./postgres.fixture.js";

it("discovers queue:migrate, initializes a fresh custom schema and preserves jobs on repeated migrations", async () => {
  const fixture = await createPostgresFixture("tasks");
  const output: string[] = [];
  /**
   * Runs one migration in its own CLI process.
   * @param args - Additional migration options.
   */
  async function migrate(args: string[] = []) {
    const running = runCli(["queue:migrate", ...args], fixture.connection);
    const code = await running.exited;
    expect(running.output(), "CLI output").toContain("version");
    expect(code, running.output()).toBe(0);
    output.push(running.output());
  }
  try {
    await fixture.pool.query("drop schema tasks cascade");
    await migrate();
    const { rows } = await fixture.pool.query(
      "select max(version) as version from tasks.migration",
    );
    expect(rows[0].version).toBe(LATEST_SCHEMA_VERSION);
    const { rows: functions } = await fixture.pool.query(
      "select count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'tasks'",
    );
    expect(functions[0].count).toBeGreaterThan(40);
    await fixture.pool.query(
      "insert into tasks.meta (queue, field, value) values ('reports', 'test', 'preserved')",
    );
    await migrate();
    expect(
      (
        await fixture.pool.query(
          "select value from tasks.meta where field = 'test'",
        )
      ).rows,
    ).toEqual([{ value: "preserved" }]);
    await migrate(["--schema", "override_tasks"]);
    expect(
      (
        await fixture.pool.query(
          "select max(version) as version from override_tasks.migration",
        )
      ).rows[0].version,
    ).toBe(LATEST_SCHEMA_VERSION);
    expect(output.join("")).toContain(
      `version ${String(LATEST_SCHEMA_VERSION)}`,
    );
  } finally {
    await fixture.close();
  }
}, 30_000);
