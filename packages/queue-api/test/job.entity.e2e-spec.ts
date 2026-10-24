import { MikroORM } from "@mikro-orm/postgresql";

import { entities } from "../dist/index.js";
import { createPostgresFixture } from "./postgres.fixture.js";

it("creates only the Job history table with database-generated UUIDs and bigint stream IDs", async () => {
  const fixture = await createPostgresFixture("public");
  const orm = await MikroORM.init({
    clientUrl: fixture.connection.connectionString,
    entities,
    schema: fixture.connection.schema,
  });
  try {
    await orm.schema.create();
    expect((await orm.schema.getUpdateSchemaSQL()).trim()).toBe("");
    const { rows } = await fixture.pool.query(
      "select table_name from information_schema.tables where table_schema = $1",
      [fixture.connection.schema],
    );
    expect(rows.map((row) => row.table_name)).toEqual(["job"]);
    const { rows: columns } = await fixture.pool.query(
      "select column_name, data_type, column_default from information_schema.columns where table_schema = $1 and table_name = 'job'",
      [fixture.connection.schema],
    );
    expect(columns.map((column) => column.column_name).sort()).toEqual([
      "created_at",
      "data",
      "failed_reason",
      "finished_at",
      "id",
      "job_id",
      "last_event_ms",
      "last_event_seq",
      "name",
      "progress",
      "queue",
      "return_value",
      "started_at",
      "status",
    ]);
    expect(columns).toContainEqual(
      expect.objectContaining({
        column_name: "id",
        data_type: "uuid",
        column_default: "gen_random_uuid()",
      }),
    );
    expect(columns).toContainEqual(
      expect.objectContaining({
        column_name: "last_event_ms",
        data_type: "bigint",
      }),
    );
    expect(columns).toContainEqual(
      expect.objectContaining({
        column_name: "last_event_seq",
        data_type: "bigint",
      }),
    );
  } finally {
    await orm.close();
    await fixture.close();
  }
}, 20000);

it("uses ordered scope indexes for cross-queue cursor reads without sorting or ownership OR", async () => {
  const fixture = await createPostgresFixture("public");
  const orm = await MikroORM.init({
    clientUrl: fixture.connection.connectionString,
    entities,
    schema: "public",
  });
  interface Plan {
    "Node Type": string;
    "Index Name"?: string;
    Plans?: Plan[];
  }
  const flatten = (plan: Plan): Plan[] => [
    plan,
    ...(plan.Plans ?? []).flatMap(flatten),
  ];
  const client = await fixture.pool.connect();
  try {
    await orm.schema.create();
    const security = await client.query(
      "select relrowsecurity from pg_class where oid = 'job'::regclass",
    );
    expect(security.rows).toEqual([{ relrowsecurity: false }]);
    expect(
      (
        await client.query(
          "select policyname from pg_policies where tablename = 'job'",
        )
      ).rows,
    ).toEqual([]);
    await client.query(`insert into job (queue, job_id, name, status, data, created_at)
      select 'queue-' || (i % 10), i::text, 'send', 'waiting',
        jsonb_build_object('userId', 'user-' || (i % 100), 'workspaceId', 'workspace-' || (i % 200)), to_timestamp(i)
      from generate_series(1, 20000) as i`);
    await client.query(`insert into job (queue, job_id, name, status, data, created_at)
      select 'maintenance', 'system-' || i, 'cleanup', 'waiting', '{}'::jsonb, to_timestamp(i * 20)
      from generate_series(1, 500) as i`);
    await client.query("analyze job");
    for (const scope of [
      {
        index: "job_user_idx",
        where: "data->>'userId' = $1",
        values: ["user-1"],
      },
      {
        index: "job_workspace_idx",
        where: "data->>'workspaceId' = $1",
        values: ["workspace-1"],
      },
      {
        index: "job_system_idx",
        where: "data->>'userId' is null and data->>'workspaceId' is null",
        values: [],
      },
    ]) {
      const result = await client.query<{ "QUERY PLAN": { Plan: Plan }[] }>(
        `explain (analyze, buffers, format json)
        select id, created_at from job where ${scope.where}
          and (created_at < to_timestamp(15000) or (created_at = to_timestamp(15000) and id < 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
        order by created_at desc, id desc limit 10`,
        scope.values,
      );
      const nodes = flatten(result.rows[0]["QUERY PLAN"][0].Plan);
      expect(nodes.map((node) => node["Index Name"])).toContain(scope.index);
      expect(nodes.map((node) => node["Node Type"])).not.toContain("Seq Scan");
      expect(nodes.map((node) => node["Node Type"])).not.toContain("Sort");
      expect(nodes.map((node) => node["Node Type"])).not.toContain("BitmapOr");
    }
  } finally {
    client.release();
    await orm.close();
    await fixture.close();
  }
}, 20000);
