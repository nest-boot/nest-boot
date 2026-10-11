import { MikroORM, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { DatabaseModule } from "@nest-boot/database";
import { GraphQLModule } from "@nest-boot/graphql";
import { RequestContextModule } from "@nest-boot/request-context";
import { ForbiddenException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { type Job as BullJob } from "bullmq";

import { JobConnectionService } from "../dist/graphql.js";
import {
  BaseProcessor,
  BaseQueue,
  Processor,
  Queue,
  QueueModule,
} from "../dist/index.js";
import {
  Job,
  jobSchemaGeneratorOptions,
  JobService,
  JobStatus,
} from "../dist/persistence.js";
import { createPostgresFixture } from "./postgres.fixture.js";

@Queue({ name: "reports" })
class ReportsQueue extends BaseQueue {}
@Queue({ name: "emails" })
class EmailsQueue extends BaseQueue {}
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
          entities: [Job],
          schemaGenerator: {
            ...jobSchemaGeneratorOptions,
            ignoreSchema: ["bullmq", fixture.connection.schema],
          },
        }),
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
      ],
      providers: [ReportsQueue, EmailsQueue, ReportsProcessor],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    orm = app.get(MikroORM);
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
    const service = new JobService(orm.em.fork(), {
      connection: fixture.connection,
      getJobReadFilter: () => ({}),
    });
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
    const service = new JobConnectionService(orm.em.fork(), {
      connection: fixture.connection,
      getJobReadFilter: () => ({ data: { owner: "alice" } }),
    });
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
      const service = new JobConnectionService(orm.em.fork(), {
        connection: fixture.connection,
        getJobReadFilter,
      });
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
    const service = new JobConnectionService(orm.em.fork(), {
      connection: fixture.connection,
      getJobReadFilter: () => ({ data: { owner: "alice" } }),
    });
    expect(
      (
        await service.getJobConnection({
          first: 10,
          filter: { id: "reports:hidden" },
        })
      ).totalCount,
    ).toBe(0);
  });

  it("excludes BullMQ tables from ORM creation, update and drop SQL", async () => {
    expect((await orm.schema.getCreateSchemaSQL()).trim()).toBe("");
    expect((await orm.schema.getUpdateSchemaSQL()).trim()).toBe("");
    expect((await orm.schema.getDropSchemaSQL()).trim()).toBe("");
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
    const service = new JobConnectionService(orm.em.fork(), {
      connection: fixture.connection,
      getJobReadFilter: () => ({}),
    });
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
    const service = new JobService(orm.em.fork(), {
      connection: fixture.connection,
      getJobReadFilter: () => ({}),
    });
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
