import { MikroORM } from "@mikro-orm/postgresql";
import { type Job } from "@nest-boot/queue";

import { JobEntity, JobStatus } from "../dist/index.js";
import { JobProcessor } from "../dist/processors/job.processor.js";
import type { JobQueue } from "../dist/queues/job.queue.js";
import { createPostgresFixture } from "./postgres.fixture.js";

describe("Job history persistence in PostgreSQL", () => {
  let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
  let orm: MikroORM;
  let processor: JobProcessor;
  beforeAll(async () => {
    fixture = await createPostgresFixture();
    orm = await MikroORM.init({
      clientUrl: fixture.connection.connectionString,
      schema: fixture.connection.schema,
      entities: [JobEntity],
    });
    await orm.schema.create();
    processor = new JobProcessor(orm.em);
  });
  beforeEach(async () => {
    await orm.em.fork().nativeDelete(JobEntity, {});
  });
  afterAll(async () => {
    await orm?.close();
    await fixture?.close();
  });
  /**
   * Applies one snapshot through the persistence processor.
   * @param data - Source event and snapshot.
   * @returns Persistence completion.
   */
  const apply = (data: Job<JobQueue, "sync">["data"]) =>
    processor.processSync({ data } as Job<JobQueue, "sync">);
  const snapshot = (jobId: string, name: string) => ({
    queue: "reports",
    jobId,
    name,
    status: JobStatus.WAITING,
    createdAt: 1000,
  });
  it("uses database-generated UUIDs, retains them on updates and ignores older stream IDs", async () => {
    await apply({ eventId: "1000-10", data: snapshot("ordered", "new") });
    const first = await orm.em
      .fork()
      .findOneOrFail(JobEntity, { jobId: "ordered" });
    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    await apply({ eventId: "1000-9", data: snapshot("ordered", "old") });
    await apply({
      eventId: "1000-10",
      data: snapshot("ordered", "duplicate"),
    });
    await apply({
      eventId: "1000-11",
      data: {
        ...snapshot("ordered", "latest"),
        // @ts-expect-error Source snapshots cannot override database-generated UUIDs.
        id: "ignore-this",
        lockToken: "obsolete-field",
        opts: { attempts: 5 },
        startedAt: 2000,
        finishedAt: 3000,
      },
    });
    const last = await orm.em
      .fork()
      .findOneOrFail(JobEntity, { jobId: "ordered" });
    expect(last.id).toBe(first.id);
    expect(last.name).toBe("latest");
    expect(last.createdAt).toEqual(new Date(1000));
    expect(last.startedAt).toEqual(new Date(2000));
    expect(last.finishedAt).toEqual(new Date(3000));
    expect(last.lastEventSeq).toBe(11n);
    expect(await orm.em.fork().count(JobEntity, { jobId: "ordered" })).toBe(1);
  });
  it("compares both bigint components atomically under concurrent consumers", async () => {
    await Promise.all(
      Array.from({ length: 30 }, (_, index) => {
        const seq = (index * 7) % 30;
        return apply({
          eventId: `9007199254740993-${String(seq)}`,
          data: snapshot("race", String(seq)),
        });
      }),
    );
    const row = await orm.em.fork().findOneOrFail(JobEntity, { jobId: "race" });
    expect(row.lastEventMs).toBe(9007199254740993n);
    expect(row.lastEventSeq).toBe(29n);
    expect(row.name).toBe("29");
    expect(await orm.em.fork().count(JobEntity, { jobId: "race" })).toBe(1);
  });
  it("generates UUIDs even for plain SQL inserts without an ID", async () => {
    const { rows } = await fixture.pool.query(
      `insert into "${fixture.connection.schema}".job (queue, job_id, name, status, created_at) values ('reports', 'sql', 'sql', 'waiting', to_timestamp(0)) returning id`,
    );
    expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("orders milliseconds before sequence numbers without losing bigint precision", async () => {
    await apply({
      eventId: "2000-9007199254740993",
      data: snapshot("precision", "initial"),
    });
    await apply({
      eventId: "2000-9007199254740994",
      data: snapshot("precision", "higher-sequence"),
    });
    let row = await orm.em
      .fork()
      .findOneOrFail(JobEntity, { jobId: "precision" });
    expect(row.lastEventSeq).toBe(9007199254740994n);
    expect(row.name).toBe("higher-sequence");
    await apply({
      eventId: "1999-9999999999999999",
      data: snapshot("precision", "older-ms"),
    });
    await apply({ eventId: "2001-0", data: snapshot("precision", "newer-ms") });
    row = await orm.em.fork().findOneOrFail(JobEntity, { jobId: "precision" });
    expect(row.lastEventMs).toBe(2001n);
    expect(row.lastEventSeq).toBe(0n);
    expect(row.name).toBe("newer-ms");
  });
});

describe("Job retention", () => {
  let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
  let orm: MikroORM;
  const now = Date.UTC(2026, 9, 23);
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    fixture = await createPostgresFixture();
    orm = await MikroORM.init({
      clientUrl: fixture.connection.connectionString,
      schema: fixture.connection.schema,
      entities: [JobEntity],
    });
    await orm.schema.create();
  });
  afterAll(async () => {
    await orm?.close();
    await fixture?.close();
  });
  afterEach(() => vi.restoreAllMocks());

  it("deletes stale records in every state across batches and falls back to creation time", async () => {
    const em = orm.em.fork();
    const statuses = Object.values(JobStatus);
    await em.upsertMany(
      JobEntity,
      Array.from({ length: 1001 }, (_, index) => ({
        queue: "reports",
        jobId: `expired-${String(index)}`,
        name: "report",
        data: {},
        status: statuses[index % statuses.length],
        createdAt: new Date(now),
        finishedAt: null,
        lastEventMs: BigInt(cutoff - 1),
      })),
    );
    await em.upsert(JobEntity, {
      queue: "reports",
      jobId: "expired-without-events",
      name: "report",
      data: {},
      status: JobStatus.ACTIVE,
      createdAt: new Date(cutoff - 1),
      lastEventMs: 0n,
    });
    const retained = [
      {
        jobId: "event-boundary",
        lastEventMs: BigInt(cutoff),
      },
      ...statuses.map((status) => ({
        jobId: `recent-${status}`,
        status,
        lastEventMs: BigInt(cutoff + 1),
      })),
      {
        jobId: "creation-boundary",
        createdAt: new Date(cutoff),
        lastEventMs: 0n,
      },
      {
        jobId: "recent-without-events",
        createdAt: new Date(cutoff + 1),
        lastEventMs: 0n,
      },
    ];
    await em.upsertMany(
      JobEntity,
      retained.map((row) => ({
        queue: "reports",
        name: "report",
        data: {},
        status: JobStatus.COMPLETED,
        createdAt: new Date(0),
        finishedAt: new Date(0),
        ...row,
      })),
    );
    vi.spyOn(Date, "now").mockReturnValue(now);
    const processor = new JobProcessor(orm.em);
    await processor.processCleanup({ data: {} } as Job<JobQueue, "cleanup">);
    expect(
      (await em.find(JobEntity, {}, { fields: ["jobId"] }))
        .map((row) => row.jobId)
        .sort(),
    ).toEqual(retained.map((row) => row.jobId).sort());
    await processor.processCleanup({ data: {} } as Job<JobQueue, "cleanup">);
    expect(await em.count(JobEntity, {})).toBe(retained.length);
  });
});
