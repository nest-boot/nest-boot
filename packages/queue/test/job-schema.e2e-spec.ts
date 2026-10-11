import { EntitySchema } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/postgresql";
import { createPostgresBackend, withBackend } from "bullmq";

import { getJobSchemaOptions, Job } from "../dist/persistence.js";
import { createPostgresFixture } from "./postgres.fixture.js";

const { Queue } = withBackend(createPostgresBackend);
const BusinessEntity = new EntitySchema({
  name: "BusinessEntity",
  tableName: "business_entity",
  schema: "public",
  properties: { id: { type: "text", primary: true } },
});

describe.each(["bullmq", "custom_tasks"])("Job migrations in %s", (schema) => {
  let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
  let orm: MikroORM;

  beforeAll(async () => {
    fixture = await createPostgresFixture(schema);
    await fixture.pool.query(
      "create table public.business_entity (id text primary key)",
    );
    await fixture.pool.query("create table public.job (id text primary key)");
    orm = await MikroORM.init({
      clientUrl: fixture.connection.connectionString,
      entities: [Job, BusinessEntity],
      ...getJobSchemaOptions(schema),
      schemaGenerator: { skipTables: ["public.job"] },
    });
  });

  afterAll(async () => {
    await orm?.close(true);
    await fixture?.close();
  });

  it("adds only ownership indexes and then produces no schema diff", async () => {
    const { rows: originalIndexes } = await fixture.pool.query(
      "select indexname, indexdef from pg_indexes where schemaname = $1 and tablename = 'job' order by indexname",
      [schema],
    );
    const migration = await orm.schema.getUpdateSchemaMigrationSQL({
      wrap: false,
    });
    const statements = migration.up
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(2);
    expect(statements).toEqual(
      expect.arrayContaining([
        `create index "job_queue_user_idx" on "${schema}"."job" ("queue", ("data"->>'userId'))`,
        `create index "job_queue_workspace_idx" on "${schema}"."job" ("queue", ("data"->>'workspaceId'))`,
      ]),
    );
    await orm.schema.execute(migration.up);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe("");
    const { rows: indexes } = await fixture.pool.query(
      "select indexname, indexdef from pg_indexes where schemaname = $1 and tablename = 'job' order by indexname",
      [schema],
    );
    expect(indexes).toHaveLength(originalIndexes.length + 2);
    expect(indexes).toEqual(expect.arrayContaining(originalIndexes));

    const queue = new Queue("reports", { connection: fixture.connection });
    try {
      const job = await queue.add("report", {
        userId: "alice",
        workspaceId: "team",
      });
      const entity = await orm.em
        .fork()
        .findOneOrFail(Job, { queue: queue.name, jobId: job.id });
      expect(entity.data).toEqual(job.data);
      expect(entity.state).toBe("waiting");
      await job.remove();
    } finally {
      await queue.close();
    }

    await orm.schema.execute(migration.down);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe(
      migration.up,
    );
    await orm.schema.execute(migration.up);
  });

  it("still detects drift in BullMQ's columns and operational indexes", async () => {
    await fixture.pool.query(
      `alter table "${schema}".job alter column priority set default 9`,
    );
    await fixture.pool.query(`drop index "${schema}".job_ready_idx`);
    const sql = await orm.schema.getUpdateSchemaSQL({ wrap: false });
    expect(sql).toContain(
      `alter table "${schema}"."job" alter column "priority" set default 0`,
    );
    expect(sql).toContain('create index "job_ready_idx"');
    expect(sql).not.toMatch(/drop (?:table|type|function)/i);
    await orm.schema.execute(sql);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe("");
  });

  it("preserves internal BullMQ objects without hiding application table changes", async () => {
    await fixture.pool.query(
      "create table public.retired_table (id text primary key)",
    );
    const sql = await orm.schema.getUpdateSchemaSQL({ wrap: false });
    expect(sql.trim()).toBe('drop table if exists "retired_table" cascade;');
    await orm.schema.execute(sql);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe("");
    const { rows } = await fixture.pool.query(
      "select to_regclass($1) as dependency, to_regtype($2) as status",
      [`${schema}.job_dependency`, `${schema}.dep_status`],
    );
    expect(rows[0].dependency).not.toBeNull();
    expect(rows[0].status).not.toBeNull();
    expect(
      (await fixture.pool.query("select to_regclass('public.job') as legacy"))
        .rows[0].legacy,
    ).not.toBeNull();
  });
});
