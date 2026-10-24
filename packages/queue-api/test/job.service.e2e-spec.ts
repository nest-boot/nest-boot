import { MikroORM } from "@mikro-orm/postgresql";
import { AuthGuard } from "@nest-boot/auth";
import { DatabaseModule } from "@nest-boot/database";
import { BaseQueue, Queue, QueueManager } from "@nest-boot/queue";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { Queue as BullmqQueue } from "bullmq";
import { z } from "zod";

import { JobEntity, QueueApiModule } from "../dist/index.js";
import { JobQueue } from "../dist/queues/job.queue.js";
import { mockAuthService } from "./auth.fixture.js";
import { createRedisFixture } from "./redis.fixture.js";

it("forwards new events in producer-only applications without replaying retained history", async () => {
  const fixture = await createRedisFixture();
  const raw = new BullmqQueue("producer", fixture.options);
  let app: TestingModule | undefined;
  @Queue("producer")
  class ProducerQueue extends BaseQueue {
    readonly jobSchemas = { send: { data: z.object({}) } };
    constructor() {
      super(fixture.options);
    }
  }
  try {
    const historical = await raw.add("send", {});
    app = await Test.createTestingModule({
      imports: [
        QueueApiModule,
        DatabaseModule.forRoot(fixture.databaseOptions),
      ],
      providers: [ProducerQueue],
    })
      .useMocker(mockAuthService)
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(JobQueue)
      .useFactory({ factory: () => new JobQueue(fixture.options) })
      .compile();
    await app.init();
    const source = app.get(ProducerQueue);
    // Observe a real event before submitting work: connection readiness alone
    // does not guarantee that BullMQ has issued its first blocking stream read.
    const resumed = vi.fn();
    source.queueEvents.on("resumed", resumed);
    try {
      await vi.waitFor(async () => {
        await source.pause();
        await source.resume();
        expect(resumed).toHaveBeenCalled();
      });
    } finally {
      source.queueEvents.off("resumed", resumed);
    }
    const fresh = await source.add("send", {});
    const sync = app.get(JobQueue);
    await vi.waitFor(async () => {
      const snapshots = (await sync.getJobs("waiting")).filter(
        (job) => job.name === "sync",
      );
      expect(snapshots.map((job) => job.data.data.jobId)).toContain(fresh.id);
      expect(snapshots.map((job) => job.data.data.jobId)).not.toContain(
        historical.id,
      );
    });
    expect(sync.queueEvents).toBeDefined();
    expect(await app.get(QueueManager).start(["job"])).toEqual(["job"]);
    const em = app.get(MikroORM).em;
    await vi.waitFor(async () => {
      expect(
        await em
          .fork()
          .findOne(JobEntity, { queue: "producer", jobId: fresh.id }),
      ).toMatchObject({ status: "waiting" });
    });
    expect(
      await em
        .fork()
        .findOne(JobEntity, { queue: "producer", jobId: historical.id }),
    ).toBeNull();
    expect(await fresh.getState()).toBe("waiting");
    expect(await historical.getState()).toBe("waiting");
  } finally {
    await app?.close();
    await raw.close();
    await fixture.close();
  }
}, 20000);
