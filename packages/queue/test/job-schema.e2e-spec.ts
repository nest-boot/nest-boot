import { EntitySchema } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/postgresql";
import { DatabaseSchema } from "@mikro-orm/sql";
import { createPostgresBackend, withBackend } from "bullmq";

import { entities, getJobSchemaOptions, Job } from "../dist/persistence.js";
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
    orm = await MikroORM.init({
      clientUrl: fixture.connection.connectionString,
      entities: [...entities, BusinessEntity],
      ...getJobSchemaOptions(schema),
    });
  });

  afterAll(async () => {
    await orm?.close(true);
    await fixture?.close();
  });

  it("adds ownership indexes and RLS and then produces no schema diff", async () => {
    const { rows: originalFunctions } = await fixture.pool.query(
      "select p.proname, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 order by p.proname",
      [schema],
    );
    // Matches MikroORM's default snapshotOnMigrate flow. A snapshot contains
    // tables and enums, while BullMQ keeps ownership of functions and sequences.
    const snapshot = await DatabaseSchema.create(
      orm.em.getConnection(),
      orm.em.getPlatform(),
      orm.config,
    );
    const { rows: originalIndexes } = await fixture.pool.query(
      "select indexname, indexdef from pg_indexes where schemaname = $1 and tablename = 'job' order by indexname",
      [schema],
    );
    const migration = await orm.schema.getUpdateSchemaMigrationSQL({
      wrap: false,
      fromSchema: snapshot,
    });
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe(
      migration.up,
    );
    expect(migration.down.match(/drop index/g)).toHaveLength(2);
    expect(migration.up + migration.down).not.toMatch(
      /(?:create|alter|drop) (?:or replace )?(?:type|function|sequence)|(?:create|drop) table/i,
    );
    const statements = migration.up
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(4);
    expect(statements).toEqual(
      expect.arrayContaining([
        `create index "job_queue_user_idx" on "${schema}"."job" ("queue", ("data"->>'userId'))`,
        `create index "job_queue_workspace_idx" on "${schema}"."job" ("queue", ("data"->>'workspaceId'))`,
        `alter table "${schema}"."job" enable row level security`,
      ]),
    );
    expect(migration.up).toContain(
      `create policy "job_select_policy" on "${schema}"."job" for select to "authenticated"`,
    );
    expect(migration.down).toContain(
      `alter table "${schema}"."job" disable row level security`,
    );
    await orm.schema.execute(migration.up);
    const { rows: functions } = await fixture.pool.query(
      "select p.proname, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 order by p.proname",
      [schema],
    );
    expect(functions).toEqual(originalFunctions);
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
      expect(entity.status).toBe("waiting");
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
    await fixture.pool.query(`drop index "${schema}".dep_child_idx`);
    await fixture.pool.query(
      `alter table "${schema}".scheduler alter column iteration_count set default 9`,
    );
    const sql = await orm.schema.getUpdateSchemaSQL({ wrap: false });
    expect(sql).toContain(
      `alter table "${schema}"."job" alter column "priority" set default 0`,
    );
    expect(sql).toContain('create index "job_ready_idx"');
    expect(sql).toContain('create index "dep_child_idx"');
    expect(sql).toContain(
      `alter table "${schema}"."scheduler" alter column "iteration_count" set default 0`,
    );
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
  });
});
