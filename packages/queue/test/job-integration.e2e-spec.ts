import { MikroORM, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { DatabaseModule } from "@nest-boot/database";
import { GraphQLModule } from "@nest-boot/graphql";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { ForbiddenException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  createPostgresBackend,
  type Job as BullJob,
  withBackend,
} from "bullmq";

import { JobConnectionService } from "../dist/graphql.js";
import {
  BaseProcessor,
  BaseQueue,
  Processor,
  Queue,
  QueueModule,
} from "../dist/index.js";
import {
  entities,
  getJobSchemaOptions,
  Job,
  JobService,
  JobStatus,
} from "../dist/persistence.js";
import { QueueRegistrar } from "../dist/queue.registrar.js";
import { createPostgresFixture } from "./postgres.fixture.js";

@Queue({ name: "reports", expose: true })
class ReportsQueue extends BaseQueue {}
@Queue({ name: "emails", expose: true })
class EmailsQueue extends BaseQueue {}
@Queue({ name: "internal" })
class InternalQueue extends BaseQueue {}
@Queue({ name: "hidden", expose: false })
class HiddenQueue extends BaseQueue {}
@Processor(ReportsQueue, { autorun: false })
class ReportsProcessor extends BaseProcessor {
  async process(job: BullJob) {
    await job.updateProgress({ done: 1 });
    if (job.data.fail) throw new Error("expected failure");
    return { saved: true };
  }
}

describe("native PostgreSQL jobs with read-only MikroORM queries", () => {
  let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
  let app: INestApplication;
  let orm: MikroORM;
  let reports: ReportsQueue;
  let emails: EmailsQueue;

  beforeAll(async () => {
    fixture = await createPostgresFixture();
    const module = await Test.createTestingModule({
      imports: [
        RequestContextModule,
        QueueModule.forRoot({
          connection: fixture.connection,
          getJobReadFilter: () => ({ data: { owner: "alice" } }),
        }),
        DatabaseModule.forRoot({
          driver: PostgreSqlDriver,
          clientUrl: fixture.connection.connectionString,
          entities,
          ...getJobSchemaOptions(fixture.connection.schema),
        }),
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
      ],
      providers: [
        ReportsQueue,
        EmailsQueue,
        InternalQueue,
        HiddenQueue,
        ReportsProcessor,
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    orm = app.get(MikroORM);
    await orm.schema.update();
    reports = app.get(ReportsQueue);
    emails = app.get(EmailsQueue);
    await app.listen(0, "127.0.0.1");
  }, 30000);

  afterAll(async () => {
    await app?.close();
    await fixture?.close();
  });

  it("reads bulk jobs immediately and retains original data when BullMQ deduplicates IDs", async () => {
    await reports.addBulk([
      {
        name: "first",
        data: { owner: "alice", original: true },
        opts: { jobId: "shared" },
      },
      { name: "second", data: { owner: "bob" }, opts: { jobId: "hidden" } },
    ]);
    await reports.add("ignored", { owner: "bob" }, { jobId: "shared" });
    await emails.add("first", { owner: "alice" }, { jobId: "shared" });
    const service = new JobService(
      orm.em.fork(),
      {
        connection: fixture.connection,
        getJobReadFilter: () => ({}),
      },
      app.get(QueueRegistrar),
    );
    expect(await service.getJob("reports:shared")).toMatchObject({
      id: "reports:shared",
      queue: "reports",
      jobId: "shared",
      name: "first",
      data: { owner: "alice", original: true },
      status: JobStatus.WAITING,
      createdAt: expect.any(Date),
    });
    expect(await service.getJob("emails:shared")).toMatchObject({
      id: "emails:shared",
    });
  });

  it("keeps cross-queue cursors stable with duplicate job IDs and sort values", async () => {
    const service = new JobConnectionService(
      orm.em.fork(),
      {
        connection: fixture.connection,
        getJobReadFilter: () => ({ data: { owner: "alice" } }),
      },
      app.get(QueueRegistrar),
    );
    const first = await service.getJobConnection({ first: 1 });
    expect(first.totalCount).toBe(2);
    expect(first.edges[0].node.id).toBe("emails:shared");
    const next = await service.getJobConnection({
      first: 1,
      after: first.pageInfo.endCursor,
    });
    expect(next.edges[0].node.id).toBe("reports:shared");
    expect(next.pageInfo.hasNextPage).toBe(false);
    const before = await service.getJobConnection({
      last: 1,
      before: next.pageInfo.endCursor,
    });
    expect(before.edges[0].node.id).toBe("emails:shared");
    const readOrdered = async (after?: string) => {
      const response = await fetch(`${await app.getUrl()}/api/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: `query($after: String) {
            jobs(first: 1, after: $after, orderBy: { field: NAME, direction: ASC }) {
              edges { node { id } }
              pageInfo { endCursor }
            }
          }`,
          variables: { after },
        }),
      });
      const result = await response.json();
      expect(result.errors).toBeUndefined();
      return result.data.jobs;
    };
    const ordered = await readOrdered();
    expect(ordered.edges[0].node.id).toBe("emails:shared");
    const orderedNext = await readOrdered(ordered.pageInfo.endCursor);
    expect(orderedNext.edges[0].node.id).toBe("reports:shared");
  });

  it("denies unconfigured readers and scopes GraphQL nodes, filters and counts", async () => {
    for (const getJobReadFilter of [undefined, () => null, () => undefined]) {
      const service = new JobConnectionService(
        orm.em.fork(),
        {
          connection: fixture.connection,
          getJobReadFilter,
        },
        app.get(QueueRegistrar),
      );
      await expect(service.getJob("reports:shared")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.getJobConnection({ first: 10 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    const response = await fetch(`${await app.getUrl()}/api/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `{ job(id: "reports:hidden") { id } jobs(first: 10) { totalCount edges { node { id status createdAt progress } } } }`,
      }),
    });
    const result = await response.json();
    expect(result.errors).toBeUndefined();
    expect(result.data.job).toBeNull();
    expect(result.data.jobs.totalCount).toBe(2);
    const service = new JobConnectionService(
      orm.em.fork(),
      {
        connection: fixture.connection,
        getJobReadFilter: () => ({ data: { owner: "alice" } }),
      },
      app.get(QueueRegistrar),
    );
    expect(
      (
        await service.getJobConnection({
          first: 10,
          filter: { id: "reports:hidden" },
        })
      ).totalCount,
    ).toBe(0);
  });

  it("hides default, disabled and unregistered queues from nodes, filters and counts", async () => {
    const { Queue: RawQueue } = withBackend(createPostgresBackend);
    const unregistered = new RawQueue("unregistered", {
      connection: fixture.connection,
    });
    try {
      for (const queue of [
        app.get(InternalQueue),
        app.get(HiddenQueue),
        unregistered,
      ]) {
        await queue.add(
          "internal-task",
          { owner: "alice" },
          { jobId: "private" },
        );
        // Exposure affects API reads, not BullMQ storage or internal queue access.
        expect(await queue.getJob("private")).toBeDefined();
        expect(
          await RequestContext.run(new RequestContext({ type: "test" }), () =>
            app.get(JobService).getJob(`${queue.name}:private`),
          ),
        ).toBeNull();
      }
      const response = await fetch(`${await app.getUrl()}/api/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: `{
            internal: job(id: "internal:private") { id }
            hidden: job(id: "hidden:private") { id }
            unregistered: job(id: "unregistered:private") { id }
            jobs(first: 10) { totalCount edges { node { queue } } }
            filtered: jobs(first: 10, filter: { queue: "internal" }) { totalCount edges { node { id } } }
          }`,
        }),
      });
      const result = await response.json();
      expect(result.errors).toBeUndefined();
      expect(result.data).toMatchObject({
        internal: null,
        hidden: null,
        unregistered: null,
        jobs: { totalCount: 2 },
        filtered: { totalCount: 0, edges: [] },
      });
      expect(
        result.data.jobs.edges
          .map(({ node }: { node: { queue: string } }) => node.queue)
          .sort(),
      ).toEqual(["emails", "reports"]);

      // An unrestricted identity filter cannot bypass the queue opt-in.
      const service = new JobConnectionService(
        orm.em.fork(),
        {
          connection: fixture.connection,
          getJobReadFilter: () => ({}),
        },
        app.get(QueueRegistrar),
      );
      expect(await service.getJob("internal:private")).toBeNull();
      expect(
        (await service.getJobConnection({ first: 10, query: "queue:internal" }))
          .totalCount,
      ).toBe(0);

      const noQueues = new JobConnectionService(
        orm.em.fork(),
        {
          connection: fixture.connection,
          getJobReadFilter: () => ({}),
        },
        { getExposedQueueNames: () => [] },
      );
      expect(await noQueues.getJob("reports:shared")).toBeNull();
      expect(await noQueues.getJobConnection({ first: 10 })).toMatchObject({
        totalCount: 0,
        edges: [],
      });
    } finally {
      await unregistered.close();
    }
  });

  it("keeps the Job schema stable and flush read-only", async () => {
    expect((await orm.schema.getUpdateSchemaSQL()).trim()).toBe("");
    const em = orm.em.fork();
    const job = await em.findOneOrFail(
      Job,
      { queue: "reports", jobId: "shared" },
      { schema: fixture.connection.schema },
    );
    job.name = "must not write";
    await em.flush();
    expect((await reports.getJob("shared"))?.name).toBe("first");
  });

  it("maps priority waiting jobs without inventing a native state", async () => {
    await emails.add("priority", {}, { jobId: "priority", priority: 7 });
    const service = new JobConnectionService(
      orm.em.fork(),
      {
        connection: fixture.connection,
        getJobReadFilter: () => ({}),
      },
      app.get(QueueRegistrar),
    );
    expect(await service.getJob("emails:priority")).toMatchObject({
      state: "waiting",
      status: JobStatus.PRIORITIZED,
    });
    const result = await service.getJobConnection({
      first: 10,
      filter: { status: JobStatus.PRIORITIZED },
    });
    expect(result.edges.map(({ node }) => node.id)).toEqual([
      "emails:priority",
    ]);
  });

  it("reads live worker results and honors BullMQ retention", async () => {
    await reports.add(
      "failure",
      { owner: "alice", fail: true },
      { jobId: "failure" },
    );
    await reports.add(
      "removed",
      { owner: "alice" },
      { jobId: "removed", removeOnComplete: true },
    );
    const processor = app.get(ReportsProcessor);
    const running = processor.worker.run();
    const service = new JobService(
      orm.em.fork(),
      {
        connection: fixture.connection,
        getJobReadFilter: () => ({}),
      },
      app.get(QueueRegistrar),
    );
    await vi.waitFor(
      async () => {
        expect(await service.getJob("reports:shared")).toMatchObject({
          status: JobStatus.COMPLETED,
          progress: { done: 1 },
          returnValue: { saved: true },
          startedAt: expect.any(Date),
          finishedAt: expect.any(Date),
        });
        expect(await service.getJob("reports:failure")).toMatchObject({
          status: JobStatus.FAILED,
          failedReason: "expected failure",
        });
        expect(await service.getJob("reports:removed")).toBeNull();
      },
      { timeout: 10000 },
    );
    await processor.worker.close();
    await running;
  }, 15000);
});
