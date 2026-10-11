import { randomUUID } from "node:crypto";

import { MikroORM } from "@mikro-orm/postgresql";
import { createPostgresBackend, withBackend } from "bullmq";
import type { PoolClient } from "pg";

import { entities, getJobSchemaOptions } from "../dist/persistence.js";
import { createPostgresFixture } from "./postgres.fixture.js";

const { Queue, Worker } = withBackend(createPostgresBackend);

describe.each(["bullmq", "custom_tasks"])("Job RLS in %s", (schema) => {
  let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
  let orm: MikroORM;
  const suffix = randomUUID().replaceAll("-", "");
  const owner = `queue_owner_${suffix}`;
  const anonymous = `queue_anonymous_${suffix}`;

  beforeAll(async () => {
    fixture = await createPostgresFixture(schema);
    orm = await MikroORM.init({
      clientUrl: fixture.connection.connectionString,
      entities,
      ...getJobSchemaOptions(schema),
    });
    await orm.schema.update();
    await fixture.pool.query(`
      create role "${owner}" nologin noinherit nosuperuser nobypassrls;
      create role "${anonymous}" nologin noinherit nosuperuser nobypassrls;
      grant "${owner}", "${anonymous}" to current_user;
      grant usage on schema "${schema}" to "${owner}", "${anonymous}", authenticated;
      grant all on all tables in schema "${schema}" to "${owner}";
      grant all on all sequences in schema "${schema}" to "${owner}";
      grant execute on all functions in schema "${schema}" to "${owner}";
      alter table "${schema}".job owner to "${owner}";
      grant select, insert, update, delete on "${schema}".job to authenticated, "${anonymous}";
    `);
    const queue = new Queue("reports", { connection: fixture.connection });
    try {
      for (const [jobId, data] of Object.entries({
        own: { userId: "alice", workspaceId: "other" },
        shared: { userId: "bob", workspaceId: "team" },
        both: { userId: "alice", workspaceId: "team" },
        foreign: { userId: "bob", workspaceId: "other" },
        background: {},
        empty: { userId: "", workspaceId: "" },
      })) {
        await queue.add("report", data, { jobId });
      }
    } finally {
      await queue.close();
    }
  });

  afterAll(async () => {
    await orm?.close(true);
    if (fixture) {
      await fixture.pool.query(`
        alter table "${schema}".job owner to current_user;
        drop owned by "${owner}", "${anonymous}";
        drop role "${owner}", "${anonymous}";
      `);
      await fixture.close();
    }
  });

  /**
   * Executes unfiltered SQL under a request role and transaction-local identity.
   * @param role - Database request role.
   * @param userId - Verified user, empty identity, or an unset session variable.
   * @param workspaceId - Verified workspace, empty identity, or an unset variable.
   * @param run - Queries to execute under RLS.
   * @returns The query result.
   */
  async function asRole<T>(
    role: string,
    userId: string | undefined,
    workspaceId: string | undefined,
    run: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await fixture.pool.connect();
    try {
      await client.query("begin");
      await client.query(`set local role "${role}"`);
      for (const [key, value] of [
        ["app.user.id", userId],
        ["app.workspace.id", workspaceId],
      ]) {
        if (value !== undefined)
          await client.query("select set_config($1, $2, true)", [key, value]);
      }
      return await run(client);
    } finally {
      await client.query("rollback");
      // A fresh connection also exercises genuinely missing session variables.
      client.release(true);
    }
  }

  it.each([
    ["alice", "team", ["both", "own", "shared"]],
    ["alice", "", ["both", "own"]],
    ["", "team", ["both", "shared"]],
    ["", "", []],
    [undefined, undefined, []],
    ["unknown", "unknown", []],
  ])(
    "isolates unfiltered reads for user %s and workspace %s",
    async (user, workspace, ids) => {
      const result = await asRole("authenticated", user, workspace, (client) =>
        client.query(
          `select id, count(*) over () as total from "${schema}".job order by id`,
        ),
      );
      expect(result.rows.map((row) => row.id)).toEqual(ids);
      for (const row of result.rows) expect(Number(row.total)).toBe(ids.length);
    },
  );

  it("denies anonymous reads even with matching session variables and SELECT privileges", async () => {
    const result = await asRole(anonymous, "alice", "team", (client) =>
      client.query(`select id from "${schema}".job`),
    );
    expect(result.rows).toEqual([]);
  });

  it("denies request writes even with matching identity and DML privileges", async () => {
    await asRole("authenticated", "alice", "team", async (client) => {
      expect(
        (
          await client.query(
            `update "${schema}".job set name = 'changed' returning id`,
          )
        ).rows,
      ).toEqual([]);
      expect(
        (await client.query(`delete from "${schema}".job returning id`)).rows,
      ).toEqual([]);
    });
    await expect(
      asRole("authenticated", "alice", "team", (client) =>
        client.query(
          `insert into "${schema}".job (queue, id, seq, name, state, data, added_at_ms) values ('reports', 'new', 100, 'report', 'waiting', '{"userId":"alice"}', 0)`,
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("lets a non-superuser table owner process every tenant and background job", async () => {
    const connection = { ...fixture.connection, options: `-c role=${owner}` };
    const completed: string[] = [];
    const errors: Error[] = [];
    const worker = new Worker(
      "reports",
      async (job) => {
        await job.updateProgress(100);
        return { processed: job.id };
      },
      { connection, concurrency: 2, autorun: false },
    );
    worker.on("completed", (job) => completed.push(String(job.id)));
    worker.on("error", (error) => errors.push(error));
    const running = worker.run();
    try {
      await vi.waitFor(
        () => {
          expect(completed).toHaveLength(6);
        },
        { timeout: 10000 },
      );
      expect(errors).toEqual([]);
      const result = await asRole(owner, undefined, undefined, (client) =>
        client.query(`select state, progress from "${schema}".job`),
      );
      expect(result.rows).toHaveLength(6);
      expect(
        result.rows.every(
          (job) => job.state === "completed" && job.progress === 100,
        ),
      ).toBe(true);
      const queue = new Queue("reports", { connection });
      try {
        for (const id of completed) await queue.remove(id);
      } finally {
        await queue.close();
      }
    } finally {
      await worker.close();
      await running;
    }
  }, 15000);
});
