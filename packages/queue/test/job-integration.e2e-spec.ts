import { randomUUID } from "node:crypto";

import { MikroORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { GraphQLModule } from "@nest-boot/graphql";
import { RequestContextModule } from "@nest-boot/request-context";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { type Job as BullJob, Queue } from "bullmq";

import {
  getQueueToken,
  Processor,
  QueueModule,
  WorkerHost,
} from "../dist/index.js";
import { Job, JobHistoryService, JobStatus } from "../dist/persistence.js";

let releaseJob: (() => void) | undefined;

const queueName = `integration-${randomUUID()}`;

@Processor(queueName)
class HistoryWorker extends WorkerHost {
  async process(job: BullJob) {
    await job.updateProgress({ done: 1 });
    if (job.data.wait)
      await new Promise<void>((resolve) => {
        releaseJob = resolve;
      });
    if (job.data.fail) throw new Error("expected failure");
    return { saved: true };
  }
}

describe("automatically discovered job history and GraphQL", () => {
  let app: INestApplication;
  let queue: Queue;
  let orm: MikroORM;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        RequestContextModule,
        QueueModule.forRoot({
          getJobReadFilter: () => ({ data: { tenant: "allowed" } }),
        }),
        QueueModule.registerQueue({ name: queueName }),
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [Job],
        }),
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
      ],
      providers: [HistoryWorker],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    orm = module.get(MikroORM);
    await orm.schema.create();
    queue = module.get(getQueueToken(queueName));
    await app.listen(0, "127.0.0.1");
  }, 30000);

  afterAll(async () => {
    await queue?.obliterate({ force: true });
    await app?.close();
  });

  it("persists completed and failed workers and scopes GraphQL rows and counts", async () => {
    const successful = await queue.add(
      "success",
      { tenant: "allowed" },
      { removeOnComplete: true },
    );
    const failed = await queue.add("failure", {
      tenant: "allowed",
      fail: true,
    });
    const hidden = await queue.add("hidden", { tenant: "other" });
    const successfulId = successful.id;
    const failedId = failed.id;
    const hiddenId = hidden.id;
    if (!successfulId || !failedId || !hiddenId)
      throw new Error("BullMQ did not assign job IDs");
    await vi.waitFor(
      async () => {
        const rows = await orm.em.fork().find(Job, {});
        expect(rows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: `${queueName}:${successfulId}`,
              status: JobStatus.COMPLETED,
              progress: { done: 1 },
              returnValue: { saved: true },
            }),
            expect.objectContaining({
              id: `${queueName}:${failedId}`,
              status: JobStatus.FAILED,
              failedReason: "expected failure",
            }),
            expect.objectContaining({
              id: `${queueName}:${hiddenId}`,
              status: JobStatus.COMPLETED,
            }),
          ]),
        );
      },
      { timeout: 15000 },
    );
    const response = await fetch(`${await app.getUrl()}/api/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `query($id: ID!) { job(id: $id) { id } jobs(first: 10) { totalCount edges { node { id status progress returnValue } } } }`,
        variables: { id: `${queueName}:${hiddenId}` },
      }),
    });
    const result = await response.json();
    expect(result.errors).toBeUndefined();
    expect(result.data.job).toBeNull();
    expect(result.data.jobs.totalCount).toBe(2);
    expect(result.data.jobs.edges).toHaveLength(2);
  }, 30000);
  it("records the final worker result while shutting down history", async () => {
    const job = await queue.add("shutdown", { tenant: "allowed", wait: true });
    await vi.waitFor(() => {
      expect(releaseJob).toBeTypeOf("function");
    });
    const stopping = app.get(JobHistoryService).onModuleDestroy();
    releaseJob?.();
    await stopping;
    const row = await orm.em
      .fork()
      .findOneOrFail(Job, { id: `${queueName}:${job.id ?? ""}` });
    expect(row.status).toBe(JobStatus.COMPLETED);
    expect(row.returnValue).toEqual({ saved: true });
  }, 15000);
});
