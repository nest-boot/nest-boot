import { MikroORM } from "@mikro-orm/postgresql";
import { AuthGuard, User } from "@nest-boot/auth";
import { DatabaseModule } from "@nest-boot/database";
import { GraphQLModule, GraphQLSchemaHost } from "@nest-boot/graphql";
import {
  BaseProcessor,
  BaseQueue,
  type Job,
  Processor,
  Queue,
  QueueManager,
} from "@nest-boot/queue";
import { RequestContext } from "@nest-boot/request-context";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { z } from "zod";

import {
  JobEntity,
  JobStatus,
  QueueApiModule,
  QueueVisible,
} from "../dist/index.js";
import { JobQueue } from "../dist/queues/job.queue.js";
import { mockAuthService } from "./auth.fixture.js";
import { createRedisFixture } from "./redis.fixture.js";

describe("Job queries over HTTP with Redis and PostgreSQL", () => {
  let fixture: Awaited<ReturnType<typeof createRedisFixture>>;
  let app: INestApplication;
  let reportIds: string[];
  let exportId: string;
  let hiddenId: string;

  @QueueVisible()
  @Queue("reports")
  class ReportsQueue extends BaseQueue {
    readonly jobSchemas = {
      report: {
        data: z.object({
          userId: z.string(),
          detailedProgress: z.boolean().optional(),
        }),
        result: z.object({ saved: z.boolean() }),
      },
    };
    constructor() {
      super(fixture.options);
    }
  }
  @QueueVisible()
  @Queue("exports")
  class ExportsQueue extends ReportsQueue {}
  @Queue("hidden-reports")
  class HiddenReportsQueue extends ReportsQueue {}
  @Processor(ReportsQueue)
  class ReportsProcessor extends BaseProcessor {
    async processReport(job: Job<ReportsQueue, "report">) {
      await job.updateProgress(
        job.data.detailedProgress ? { secret: "internal-progress" } : 80,
      );
      return { saved: true };
    }
  }
  @Processor(ExportsQueue)
  class ExportsProcessor extends ReportsProcessor {}
  @Processor(HiddenReportsQueue)
  class HiddenReportsProcessor extends ReportsProcessor {}

  beforeAll(async () => {
    fixture = await createRedisFixture();
    const module = await Test.createTestingModule({
      imports: [
        QueueApiModule,
        DatabaseModule.forRoot(fixture.databaseOptions),
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
      ],
      providers: [
        { provide: ReportsQueue, useFactory: () => new ReportsQueue() },
        ExportsQueue,
        ReportsProcessor,
        ExportsProcessor,
        HiddenReportsQueue,
        HiddenReportsProcessor,
      ],
    })
      .useMocker(mockAuthService)
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(JobQueue)
      .useFactory({ factory: () => new JobQueue(fixture.options) })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.use((_req: unknown, _res: unknown, next: () => void) => {
      const context = new RequestContext({ type: "http" });
      context.set(User, Object.assign(new User(), { id: "alice" }));
      void RequestContext.run(context, () => {
        next();
      });
    });
    await app.listen(0, "127.0.0.1");
    await app.get(QueueManager).start();
    const jobs = await app.get(ReportsQueue).addBulk([
      { name: "report", data: { userId: "alice" } },
      { name: "report", data: { userId: "alice", detailedProgress: true } },
    ]);
    const exportJob = await app
      .get(ExportsQueue)
      .add("report", { userId: "alice" });
    const hiddenJob = await app
      .get(HiddenReportsQueue)
      .add("report", { userId: "alice" });
    const em = app.get(MikroORM).em;
    await vi.waitFor(async () => {
      const rows = await em
        .fork()
        .find(JobEntity, { status: JobStatus.COMPLETED });
      expect(rows).toHaveLength(4);
      reportIds = jobs.map((job) => {
        const row = rows.find(
          (row) => row.queue === "reports" && row.jobId === job.id,
        );
        if (!row) {
          throw new Error("Missing report history");
        }
        return row.id;
      });
      const row = rows.find(
        (row) => row.queue === "exports" && row.jobId === exportJob.id,
      );
      if (!row) {
        throw new Error("Missing export history");
      }
      exportId = row.id;
      const hidden = rows.find(
        (row) => row.queue === "hidden-reports" && row.jobId === hiddenJob.id,
      );
      if (!hidden) {
        throw new Error("Missing hidden report history");
      }
      hiddenId = hidden.id;
    });
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await fixture?.close();
  });

  /**
   * Executes a query through the application's real GraphQL endpoint.
   * @param query - GraphQL document.
   * @param variables - GraphQL variables.
   * @returns JSON response.
   */
  async function graphql(
    query: string,
    variables: Record<string, unknown> = {},
  ) {
    const response = await fetch(`${await app.getUrl()}/api/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    expect(response.status).toBe(200);
    return await response.json();
  }
  it("persists unmarked queues while hiding their records from API queries", async () => {
    const result = await graphql(`{
      userJob(id:"${hiddenId}"){id}
      userJobs(first:10,filter:{queue:"hidden-reports"}){totalCount edges{node{id}}}
    }`);
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      userJob: null,
      userJobs: { totalCount: 0, edges: [] },
    });
  });
  it("reads synchronized history across queues and rejects invalid identifiers", async () => {
    for (const [id, expected] of [
      [
        reportIds[0],
        {
          id: reportIds[0],
          queue: "reports",
          name: "report",
          status: "COMPLETED",
          progress: 80,
        },
      ],
      [
        reportIds[1],
        {
          id: reportIds[1],
          queue: "reports",
          name: "report",
          status: "COMPLETED",
          progress: null,
        },
      ],
      [
        exportId,
        {
          id: exportId,
          queue: "exports",
          name: "report",
          status: "COMPLETED",
          progress: 80,
        },
      ],
      ["invalid", null],
    ] as const) {
      const result = await graphql(
        "query($id: ID!) { userJob(id: $id) { id queue name status progress } }",
        { id },
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.userJob).toEqual(expected);
    }
  });
  it("paginates history across queues using stable UUID cursors", async () => {
    const query =
      "query($after: String) { userJobs(first: 1, after: $after) { totalCount pageInfo { endCursor hasNextPage } edges { node { id } } } }";
    const first = await graphql(query);
    expect(first.errors).toBeUndefined();
    expect(first.data.userJobs.totalCount).toBe(3);
    expect(first.data.userJobs.pageInfo.hasNextPage).toBe(true);
    const second = await graphql(query, {
      after: first.data.userJobs.pageInfo.endCursor,
    });
    expect(second.errors).toBeUndefined();
    expect(second.data.userJobs.totalCount).toBe(3);
    expect(second.data.userJobs.pageInfo.hasNextPage).toBe(true);
    const third = await graphql(query, {
      after: second.data.userJobs.pageInfo.endCursor,
    });
    expect(third.errors).toBeUndefined();
    expect(third.data.userJobs.totalCount).toBe(3);
    expect(third.data.userJobs.pageInfo.hasNextPage).toBe(false);
    expect(
      new Set([
        first.data.userJobs.edges[0].node.id,
        second.data.userJobs.edges[0].node.id,
        third.data.userJobs.edges[0].node.id,
      ]),
    ).toEqual(new Set([...reportIds, exportId]));
  });
  it("keeps payloads, raw results and internal stream versions out of the GraphQL schema", () => {
    const type = app.get(GraphQLSchemaHost).schema.getType("Job");
    expect(
      type && "getFields" in type ? Object.keys(type.getFields()) : [],
    ).toEqual(
      expect.arrayContaining(["id", "queue", "name", "status", "progress"]),
    );
    const fields =
      type && "getFields" in type ? Object.keys(type.getFields()) : [];
    for (const field of [
      "jobId",
      "data",
      "returnValue",
      "failedReason",
      "lastEventMs",
      "lastEventSeq",
    ]) {
      expect(fields).not.toContain(field);
    }
  });
});
