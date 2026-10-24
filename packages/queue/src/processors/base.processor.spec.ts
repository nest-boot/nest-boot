import { RequestContext } from "@nest-boot/request-context";
import type { Job as BullmqJob } from "bullmq";
import { z } from "zod";

import { createQueueTestingModule } from "../../test/queue-testing.fixture.js";
import {
  BaseProcessor,
  BaseQueue,
  type Job,
  JOB_REF,
  Processor,
  Queue,
  QueueManager,
  QueueModule,
} from "../index.js";

const { workers } = vi.hoisted(() => ({ workers: [] as any[] }));
vi.mock("bullmq", async (original) => {
  const actual = await original<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  class Transport extends EventEmitter {
    close = vi.fn().mockResolvedValue(undefined);
    waitUntilReady = vi.fn().mockResolvedValue(undefined);
    run = vi.fn().mockResolvedValue(undefined);
    constructor(
      readonly name: string,
      readonly opts: object,
    ) {
      super();
    }
  }
  class Worker extends Transport {
    constructor(
      name: string,
      readonly processJob: (...args: any[]) => Promise<any>,
      opts: object,
    ) {
      super(name, opts);
      workers.push(this);
    }
  }
  return {
    ...actual,
    Queue: Transport,
    QueueEvents: Transport,
    Worker: Worker,
  };
});

afterEach(() => {
  workers.length = 0;
  vi.restoreAllMocks();
});

it("reuses one processor while isolating concurrent job contexts", async () => {
  @Queue("scope")
  class TaskQueue extends BaseQueue {
    readonly jobSchemas = { task: { data: z.object({}), result: z.unknown() } };
    constructor() {
      super({ connection: { host: "queue-host" } });
    }
  }
  let created = 0;
  @Processor(TaskQueue)
  class TaskProcessor extends BaseProcessor {
    readonly id = ++created;
    constructor() {
      super({ concurrency: 3 });
    }
    async processTask(
      job: Job<TaskQueue, "task">,
      token?: string,
      signal?: AbortSignal,
    ) {
      const context = RequestContext.current();
      await Promise.resolve();
      expect(RequestContext.current()).toBe(context);
      expect(context.get(JOB_REF)).toBe(job);
      return { consumer: this, context, token, signal };
    }
  }
  const app = await createQueueTestingModule({
    imports: [QueueModule],
    providers: [TaskQueue, TaskProcessor],
  }).compile();
  try {
    await app.init();
    await app.get(QueueManager).start();
    expect(workers).toHaveLength(1);
    const [worker] = workers;
    expect(worker.opts).toMatchObject({
      connection: { host: "queue-host" },
      concurrency: 3,
    });
    const signal = new AbortController().signal;
    const [first, second] = await Promise.all([
      worker.processJob({ id: "1", name: "task", data: {} }, "one", signal),
      worker.processJob({ id: "2", name: "task", data: {} }, "two"),
    ]);
    expect(first.context).not.toBe(second.context);
    expect(first.context.id).toBe("1");
    expect(second.context.id).toBe("2");
    expect(first.consumer).toBe(second.consumer);
    expect(first.consumer).toBe(app.get(TaskProcessor));
    expect(created).toBe(1);
    expect(first.token).toBe("one");
    expect(first.signal).toBe(signal);
    expect(RequestContext.isActive()).toBe(false);
  } finally {
    await app.close();
  }
  expect(workers[0].close).toHaveBeenCalledOnce();
});

it("validates external payloads and results, and preserves original data for singleton processors", async () => {
  @Queue()
  class ValidatedQueue extends BaseQueue {
    readonly jobSchemas = {
      length: {
        data: z.object({ text: z.string().transform((text) => text.length) }),
        result: z.number(),
      },
      notify: { data: z.object({ userId: z.string() }) },
    };
  }
  @Processor(ValidatedQueue)
  class ValidatedProcessor extends BaseProcessor {
    async processLength(job: Job<ValidatedQueue, "length">) {
      await Promise.resolve();
      expect(RequestContext.get(JOB_REF)).toBe(job);
      expectTypeOf(job.data.text).toEqualTypeOf<string>();
      expectTypeOf<typeof job.updateData>()
        .parameter(0)
        .toEqualTypeOf<{ text: string }>();
      return job.data.text.length;
    }
    async processNotify(job: Job<ValidatedQueue, "notify">) {
      await Promise.resolve();
      expect(RequestContext.get(JOB_REF)).toBe(job);
    }
  }
  const app = await createQueueTestingModule({
    imports: [QueueModule],
    providers: [ValidatedQueue, ValidatedProcessor],
  }).compile();
  try {
    await app.init();
    await app.get(QueueManager).start();
    const worker = workers[0];
    const process = vi.spyOn(app.get(ValidatedProcessor), "processLength");
    const notify = vi.spyOn(app.get(ValidatedProcessor), "processNotify");
    await expect(
      worker.processJob({
        id: "valid",
        name: "length",
        data: { text: "hello" },
      }),
    ).resolves.toBe(5);
    await expect(
      worker.processJob({
        id: "void",
        name: "notify",
        data: { userId: "123" },
      }),
    ).resolves.toBeUndefined();
    expect(process).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
    expect(process.mock.calls[0][0].data).toEqual({ text: "hello" });
    await expect(
      worker.processJob({
        id: "bad-data",
        name: "length",
        data: { text: 123 },
      }),
    ).rejects.toMatchObject({
      issues: [{ code: "invalid_type", path: ["text"] }],
    });
    await expect(
      worker.processJob({ id: "bad-name", name: "missing", data: {} }),
    ).rejects.toThrow('Unknown job "missing"');
    expect(process).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
    process.mockResolvedValueOnce("invalid" as never);
    await expect(
      worker.processJob({
        id: "bad-result",
        name: "length",
        data: { text: "hello" },
      }),
    ).rejects.toThrow();
    notify.mockResolvedValueOnce(123 as never);
    await expect(
      worker.processJob({
        id: "undeclared-result",
        name: "notify",
        data: { userId: "123" },
      }),
    ).rejects.toThrow("does not declare a result schema");
  } finally {
    await app.close();
  }
});

describe("inherited named handlers", () => {
  @Queue("email")
  class EmailQueue extends BaseQueue {
    readonly jobSchemas = { send: { data: z.object({}) } };
  }
  it("discovers inherited handlers and runs them in a job context", async () => {
    const contexts: RequestContext[] = [];
    const argumentsSeen: unknown[][] = [];
    class BaseWorker extends BaseProcessor {
      async processSend(job: Job<EmailQueue, "send">, token?: string) {
        await Promise.resolve();
        contexts.push(RequestContext.current());
        argumentsSeen.push([this, job, token]);
      }
    }
    @Processor(EmailQueue)
    class EmailProcessor extends BaseWorker {}
    const module = await createQueueTestingModule({
      imports: [QueueModule],
      providers: [EmailQueue, EmailProcessor],
    }).compile();
    try {
      await module.init();
      await module.get(QueueManager).start();
      const processor = module.get(EmailProcessor);
      const job = { id: "job-1", name: "send", data: {} } as BullmqJob;
      await workers[0].processJob(job, "lock-token");
      expect(contexts).toHaveLength(1);
      expect(contexts[0].type).toBe("queue");
      expect(contexts[0].id).toBe(job.id);
      expect(contexts[0].get(JOB_REF)).toBe(job);
      expect(argumentsSeen).toEqual([[processor, job, "lock-token"]]);
      expect(RequestContext.isActive()).toBe(false);
    } finally {
      await module.close();
    }
  });
});
