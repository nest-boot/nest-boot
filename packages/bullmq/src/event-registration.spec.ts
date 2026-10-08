import { RequestContext } from "@nest-boot/request-context";
import { JOB_REF } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { Job } from "bullmq";

import {
  BullModule,
  OnQueueEvent,
  OnWorkerEvent,
  Processor,
  QueueEventsHost,
  QueueEventsListener,
  WorkerHost,
} from "./index.js";

// Keep Nest's real discovery, decorators and listener registration. Only the
// Redis-backed transports are replaced with local emitters in this test.
vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");

  class Queue extends EventEmitter {
    constructor(
      readonly name: string,
      readonly opts: object,
    ) {
      super();
    }

    async close() {
      await Promise.resolve();
      this.removeAllListeners();
    }
  }

  class Worker extends Queue {
    constructor(
      name: string,
      private readonly processor: (job: Job, token: string) => Promise<unknown>,
      opts: object,
    ) {
      super(name, opts);
    }

    async processJob(job: Job, token: string) {
      return await this.processor(job, token);
    }
  }

  return { ...actual, Queue, Worker, QueueEvents: Queue };
});

describe("Nest BullMQ event registration", () => {
  it("discovers inherited handlers and binds both event types with independent contexts", async () => {
    const contexts: RequestContext[] = [];
    const argumentsSeen: unknown[][] = [];

    class BaseWorker extends WorkerHost {
      async process(job: Job, token?: string) {
        await Promise.resolve();
        contexts.push(RequestContext.current());
        argumentsSeen.push([job, token]);
      }

      @OnWorkerEvent("completed")
      async completed(job: Job, result: unknown, previous: string) {
        await Promise.resolve();
        contexts.push(RequestContext.current());
        argumentsSeen.push([this, job, result, previous]);
      }
    }

    @Processor("email")
    class EmailWorker extends BaseWorker {}

    class BaseQueueListener extends QueueEventsHost {
      @OnQueueEvent("completed")
      async completed(event: { jobId: string }, streamId: string) {
        await Promise.resolve();
        contexts.push(RequestContext.current());
        argumentsSeen.push([this, event, streamId]);
      }
    }

    @QueueEventsListener("email")
    class EmailQueueListener extends BaseQueueListener {}

    const module = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection: { host: "localhost", port: 6379 } }),
        BullModule.registerQueue({ name: "email" }),
      ],
      providers: [EmailWorker, EmailQueueListener],
    }).compile();

    try {
      await module.init();
      const worker = module.get(EmailWorker);
      const listener = module.get(EmailQueueListener);
      const job = { id: "job-1" } as Job;
      const payload = { jobId: "job-1", returnvalue: "result", prev: "active" };

      await worker.worker.processJob(job, "lock-token");
      expect(worker.worker.emit("completed", job, "result", "active")).toBe(
        true,
      );
      expect(listener.queueEvents.emit("completed", payload, "123-0")).toBe(
        true,
      );
      await vi.waitFor(() => {
        expect(contexts).toHaveLength(3);
      });

      expect(new Set(contexts).size).toBe(3);
      expect(contexts.map((ctx) => ctx.type)).toEqual([
        "queue",
        "queue",
        "queue",
      ]);
      expect(contexts.map((ctx) => ctx.id)).toEqual([job.id, job.id, job.id]);
      expect(contexts.map((ctx) => ctx.get(JOB_REF))).toEqual([
        job,
        job,
        undefined,
      ]);
      expect(argumentsSeen).toEqual([
        [job, "lock-token"],
        [worker, job, "result", "active"],
        [listener, payload, "123-0"],
      ]);
      expect(RequestContext.isActive()).toBe(false);
    } finally {
      await module.close();
    }
  });
});
