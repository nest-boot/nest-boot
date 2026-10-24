import { EntityManager } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/postgresql";
import { AuthGuard } from "@nest-boot/auth";
import { DatabaseModule } from "@nest-boot/database";
import {
  BaseProcessor,
  BaseQueue,
  type Job,
  JOB_REF,
  Processor,
  Queue,
  QueueManager,
} from "@nest-boot/queue";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Job as BullmqJob, Queue as BullmqQueue } from "bullmq";
import { z } from "zod";

import { JobEntity, JobStatus, QueueApiModule } from "../dist/index.js";
import { JobProcessor } from "../dist/processors/job.processor.js";
import { JobQueue } from "../dist/queues/job.queue.js";
import { mockAuthService } from "./auth.fixture.js";
import { createRedisFixture } from "./redis.fixture.js";

@Queue("reports")
class ReportsQueue extends BaseQueue {
  readonly jobSchemas = {
    report: {
      data: z.object({
        userId: z.string().optional(),
        fail: z.boolean().optional(),
      }),
      result: z.object({ saved: z.boolean() }),
    },
  };
}
@Processor(ReportsQueue)
class ReportsProcessor extends BaseProcessor {
  async processReport(job: Job<ReportsQueue, "report">) {
    await job.updateProgress(80);
    if (job.data.fail) {
      throw new Error("expected failure");
    }
    return { saved: true };
  }
}

describe("Redis QueueEvents and Job history", () => {
  let redis: Awaited<ReturnType<typeof createRedisFixture>>;
  let app: INestApplication;
  let producer: TestingModule;
  let orm: MikroORM;
  let sync: BullmqQueue;
  beforeAll(async () => {
    redis = await createRedisFixture();
    const options = redis.options;
    const module = await Test.createTestingModule({
      imports: [
        RequestContextModule,
        QueueApiModule,
        DatabaseModule.forRoot({
          ...redis.databaseOptions,
          session: () =>
            RequestContext.get<BullmqJob>(JOB_REF)?.queueName === "job"
              ? { role: "authenticated" }
              : undefined,
        }),
      ],
      providers: [
        { provide: ReportsQueue, useFactory: () => new ReportsQueue(options) },
        ReportsProcessor,
      ],
    })
      .useMocker(mockAuthService)
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(JobQueue)
      .useFactory({ factory: () => new JobQueue(redis.options) })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    orm = app.get(MikroORM);
    await app.init();
    producer = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          ...redis.databaseOptions,
          session: () =>
            RequestContext.get<BullmqJob>(JOB_REF)?.queueName === "job"
              ? { role: "authenticated" }
              : undefined,
        }),
        QueueApiModule,
      ],
      providers: [
        { provide: ReportsQueue, useFactory: () => new ReportsQueue(options) },
      ],
    })
      .useMocker(mockAuthService)
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(JobQueue)
      .useFactory({ factory: () => new JobQueue(redis.options) })
      .compile();
    await producer.init();
    sync = new BullmqQueue("job", redis.options);
    await app.get(QueueManager).start();
  }, 30000);
  afterAll(async () => {
    await producer?.close();
    await app?.close();
    await sync?.close();
    await redis?.close();
  });

  const snapshot = (jobId: string, name: string) => ({
    queue: "reports",
    jobId,
    name,
    status: JobStatus.WAITING,
    createdAt: 1000,
  });
  it("registers Job as a standard queue and contextual processor", async () => {
    const queue = app.get(JobQueue);
    const processor = app.get(JobProcessor);
    expect(queue).toBeInstanceOf(BaseQueue);
    expect(processor).toBeInstanceOf(BaseProcessor);
    expect(queue.opts).toMatchObject({
      ...redis.options,
      defaultJobOptions: {
        attempts: 20,
        backoff: { type: "exponential", delay: 1000 },
      },
    });
    expect(producer.get(JobProcessor)).toBeInstanceOf(JobProcessor);
    const contexts: unknown[] = [];
    const process = processor.processSync.bind(processor);
    const observed = vi
      .spyOn(processor, "processSync")
      .mockImplementation(async (job) => {
        contexts.push({
          type: RequestContext.current().type,
          jobId: RequestContext.get<BullmqJob>(JOB_REF)?.id,
          role: RequestContext.get(EntityManager)?.getSessionContext()?.role,
        });
        await process(job);
      });
    try {
      const job = await queue.add("sync", {
        eventId: "1000-1",
        data: snapshot("standard", "standard"),
      });
      await vi.waitFor(async () => {
        expect(
          await orm.em.fork().count(JobEntity, { jobId: "standard" }),
        ).toBe(1);
      });
      expect(contexts).toContainEqual({
        type: "queue",
        jobId: job.id,
        role: "authenticated",
      });
    } finally {
      observed.mockRestore();
    }
  });
  it("deduplicates the same source events received by producer and Worker applications", async () => {
    const source = producer.get(ReportsQueue);
    const job = await source.add("report", { userId: "alice" });
    await vi.waitFor(async () => {
      const row = await orm.em
        .fork()
        .findOne(JobEntity, { queue: source.name, jobId: job.id });
      expect(row).toMatchObject({
        status: JobStatus.COMPLETED,
        data: { userId: "alice" },
        returnValue: { saved: true },
      });
    });
    const row = await orm.em
      .fork()
      .findOneOrFail(JobEntity, { queue: source.name, jobId: job.id });
    expect(row.createdAt).toEqual(new Date(job.timestamp));
    expect(row.startedAt).toBeInstanceOf(Date);
    expect(row.finishedAt).toBeInstanceOf(Date);
    const client = await sync.getBackend().client;
    const sourceRead = (await client.xread([
      { key: source.toKey("events"), id: "0-0" },
    ])) as [string, [string, string[]][]][] | null;
    const sourceIds = new Set(
      (sourceRead?.[0]?.[1] ?? [])
        .filter(([, values]) => values.includes(String(job.id)))
        .map(([id]) => JSON.stringify([source.qualifiedName, id])),
    );
    await vi.waitFor(async () => {
      const read = (await client.xread([
        { key: sync.toKey("events"), id: "0-0" },
      ])) as [string, [string, string[]][]][] | null;
      const deduplicated = (read?.[0]?.[1] ?? []).some(([, values]) => {
        const fields = Object.fromEntries(
          Array.from({ length: values.length / 2 }, (_, i) => [
            values[i * 2],
            values[i * 2 + 1],
          ]),
        );
        return (
          fields.event === "deduplicated" &&
          sourceIds.has(fields.deduplicationId)
        );
      });
      expect(deduplicated).toBe(true);
    });
    expect(await orm.em.fork().count(JobEntity, { queue: "job" })).toBe(0);
  });
  it("retries failed Job history writes and eventually persists the completed job", async () => {
    const processor = app.get(JobProcessor);
    const process = processor.processSync.bind(processor);
    let failedId: string | undefined;
    const retry = vi
      .spyOn(processor, "processSync")
      .mockImplementation(async (job) => {
        if (job.data.data.jobId === "retry-source" && failedId === undefined) {
          failedId = job.id;
          throw new Error("temporary history database outage");
        }
        await process(job);
      });
    try {
      const job = await producer
        .get(ReportsQueue)
        .add("report", {}, { jobId: "retry-source" });
      await vi.waitFor(
        async () => {
          expect(
            await orm.em
              .fork()
              .findOne(JobEntity, { queue: "reports", jobId: job.id }),
          ).toMatchObject({ status: JobStatus.COMPLETED });
          const counts = await sync.getJobCounts(
            "waiting",
            "delayed",
            "active",
          );
          expect(counts).toMatchObject({ waiting: 0, delayed: 1, active: 0 });
        },
        { timeout: 12000 },
      );
      expect(failedId).toBeDefined();
      expect(
        retry.mock.calls.filter(([job]) => job.id === failedId).length,
      ).toBeGreaterThanOrEqual(2);
    } finally {
      retry.mockRestore();
    }
  }, 15000);
  it("synchronizes Redis prioritized state", async () => {
    const queue = app.get(ReportsQueue);
    await queue.pause();
    try {
      const job = await producer
        .get(ReportsQueue)
        .add("report", {}, { priority: 7 });
      await vi.waitFor(async () => {
        expect(
          (await orm.em.fork().findOne(JobEntity, { jobId: job.id }))?.status,
        ).toBe(JobStatus.PRIORITIZED);
      });
    } finally {
      await queue.resume();
    }
  });
  it("registers one daily cleanup scheduler across application replicas", async () => {
    const schedulers = await app.get(JobQueue).getJobSchedulers();
    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]).toMatchObject({
      key: "cleanup",
      name: "cleanup",
      pattern: "0 0 * * *",
      tz: "UTC",
    });
  });

  it("consumes cleanup with an independent database context and removes stale active jobs", async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const rows = [
      {
        jobId: "cleanup-expired",
        status: JobStatus.COMPLETED,
        lastEventMs: BigInt(now - 31 * day),
      },
      {
        jobId: "cleanup-failed",
        status: JobStatus.FAILED,
        lastEventMs: BigInt(now - 31 * day),
      },
      {
        jobId: "cleanup-recent",
        status: JobStatus.COMPLETED,
        lastEventMs: BigInt(now - day),
      },
      {
        jobId: "cleanup-stale-active",
        status: JobStatus.ACTIVE,
        lastEventMs: 0n,
      },
      {
        jobId: "cleanup-active",
        status: JobStatus.ACTIVE,
        lastEventMs: BigInt(now),
      },
    ];
    await orm.em.fork().upsertMany(
      JobEntity,
      rows.map((row) => ({
        queue: "retention-test",
        name: "report",
        data: {},
        createdAt: new Date(now - 60 * day),
        ...row,
      })),
    );
    const job = await app.get(JobQueue).add("cleanup", {});
    await vi.waitFor(async () => {
      expect(await job.getState()).toBe("unknown");
      expect(
        await orm.em.fork().count(JobEntity, {
          queue: "retention-test",
          jobId: {
            $in: ["cleanup-expired", "cleanup-failed", "cleanup-stale-active"],
          },
        }),
      ).toBe(0);
    });
    const retained = await orm.em
      .fork()
      .find(JobEntity, { queue: "retention-test" });
    expect(retained.map((row) => row.jobId).sort()).toEqual([
      "cleanup-active",
      "cleanup-recent",
    ]);
  });

  it("starts job alone without business queue declarations", async () => {
    const standalone = await Test.createTestingModule({
      imports: [QueueApiModule, DatabaseModule.forRoot(redis.databaseOptions)],
    })
      .useMocker(mockAuthService)
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(JobQueue)
      .useFactory({ factory: () => new JobQueue(redis.options) })
      .compile();
    try {
      await standalone.init();
      expect(await standalone.get(QueueManager).start(["job"])).toEqual([
        "job",
      ]);
    } finally {
      await standalone.close();
    }
  });
  it("preserves terminal event results when the original job is already removed", async () => {
    const source = producer.get(ReportsQueue);
    const client = await source.getBackend().client;
    await client.xadd(source.toKey("events"), "*", {
      event: "completed",
      jobId: "already-removed",
      returnvalue: JSON.stringify({ kept: true }),
      prev: "active",
    });
    await vi.waitFor(async () => {
      const row = await orm.em
        .fork()
        .findOne(JobEntity, { jobId: "already-removed" });
      expect(row?.status).toBe(JobStatus.COMPLETED);
      expect(row?.returnValue).toEqual({ kept: true });
    });
  });
  it("persists waiting jobs while the business queue is paused", async () => {
    const queue = app.get(ReportsQueue);
    await queue.pause();
    try {
      const job = await producer.get(ReportsQueue).add("report", {});
      await vi.waitFor(async () => {
        expect(
          (await orm.em.fork().findOne(JobEntity, { jobId: job.id }))?.status,
        ).toBe(JobStatus.WAITING);
      });
      expect(await job.getState()).toBe("waiting");
    } finally {
      await queue.resume();
    }
  });
});
