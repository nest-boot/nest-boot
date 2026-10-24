import { Injectable, Scope } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { z } from "zod";

import { createQueueTestingModule } from "../test/queue-testing.fixture.js";
import {
  BaseProcessor,
  BaseQueue,
  type Job,
  Processor,
  Queue,
  QueueManager,
  QueueModule,
} from "./index.js";

const { workers, readiness } = vi.hoisted(() => ({
  workers: [] as any[],
  readiness: vi.fn(),
}));
vi.mock("bullmq", async (original) => {
  const actual = await original<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  class Transport extends EventEmitter {
    close = vi.fn().mockResolvedValue(undefined);
    run = vi.fn().mockResolvedValue(undefined);
    waitUntilReady = readiness;
    constructor(
      readonly name: string,
      readonly opts: object,
    ) {
      super();
    }
  }
  class Worker extends Transport {
    constructor(name: string, _processor: unknown, opts: object) {
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

@Queue("email")
class EmailQueue extends BaseQueue {
  readonly jobSchemas = { send: { data: z.object({}) } };
}
@Queue("reports")
class ReportsQueue extends BaseQueue {
  readonly jobSchemas = { send: { data: z.object({}) } };
}
@Processor(EmailQueue)
class EmailProcessor extends BaseProcessor {
  constructor() {
    super({ concurrency: 4 });
  }
  async processSend(_job: Job<EmailQueue, "send">) {
    await Promise.resolve();
  }
}
@Processor(ReportsQueue)
class ReportsProcessor extends EmailProcessor {}
@Queue("job")
class JobQueue extends BaseQueue {
  readonly jobSchemas = { sync: { data: z.object({}) } };
}
@Processor(JobQueue)
class JobProcessor extends BaseProcessor {
  async processSync(_job: Job<JobQueue, "sync">) {
    await Promise.resolve();
  }
}
/**
 * @param withSyncProcessor - Include another consumer named job.
 * @returns Initialized application with declared queues.
 */
async function createApp(withSyncProcessor = false) {
  const app = await createQueueTestingModule({
    imports: [QueueModule],
    providers: [
      EmailQueue,
      ReportsQueue,
      EmailProcessor,
      ReportsProcessor,
      ...(withSyncProcessor ? [JobQueue, JobProcessor] : []),
    ],
  }).compile();
  await app.init();
  return app;
}

beforeEach(() => {
  workers.length = 0;
  readiness.mockReset().mockResolvedValue(undefined);
});

it("does not create workers when an application starts", async () => {
  const app = await createApp();
  try {
    expect(workers).toEqual([]);
    expect(() => app.get(EmailProcessor).worker).toThrow("not initialized");
  } finally {
    await app.close();
  }
});

it("starts only selected consumers", async () => {
  const app = await createApp();
  try {
    expect(await app.get(QueueManager).start(["email", "email"])).toEqual([
      "email",
    ]);
    expect(workers.map((w) => w.name)).toEqual(["email"]);
    expect(workers[0].opts).toMatchObject({ autorun: false, concurrency: 4 });
    expect(workers[0].run).toHaveBeenCalledOnce();
    expect(app.get(EmailProcessor).worker).toBe(workers[0]);
    expect(() => app.get(ReportsProcessor).worker).toThrow("not initialized");
    await expect(app.get(QueueManager).start()).rejects.toThrow(
      "already been started",
    );
  } finally {
    await app.close();
  }
  expect(workers[0].close).toHaveBeenCalledOnce();
});

it("rejects unknown queues before creating transports and permits a corrected selection", async () => {
  const app = await createApp();
  try {
    await expect(
      app.get(QueueManager).start(["email", "typo"]),
    ).rejects.toThrow('Unknown queue "typo"');
    expect(workers).toEqual([]);
    await app.get(QueueManager).start();
    expect(workers.map((w) => w.name)).toEqual(["email", "reports"]);
  } finally {
    await app.close();
  }
});

it.each([
  { selection: ["producer"], expected: [] },
  { selection: ["job"], expected: ["job"] },
  { selection: ["email", "producer"], expected: ["email"] },
  {
    selection: ["email", "job"],
    expected: ["email", "job"],
  },
  {
    selection: ["job", "producer"],
    expected: ["job"],
  },
  { selection: undefined, expected: ["email", "job"] },
  { selection: [], expected: ["email", "job"] },
])(
  "filters every registered consumer by queue name: $selection",
  async ({ selection, expected }) => {
    @Queue("producer")
    class ProducerQueue extends BaseQueue {}
    const app = await createQueueTestingModule({
      imports: [QueueModule],
      providers: [
        EmailQueue,
        EmailProcessor,
        ProducerQueue,
        JobQueue,
        JobProcessor,
      ],
    }).compile();
    try {
      await app.init();
      const manager = app.get(QueueManager);
      expect((await manager.start(selection)).sort()).toEqual(expected);
      expect(workers.map((worker) => worker.name).sort()).toEqual(expected);
      if (!expected.length) {
        // An empty match must not mark consumers as started.
        expect(await manager.start(["email"])).toEqual(["email"]);
      }
    } finally {
      await app.close();
    }
  },
);

it("waits for every transport to become ready before running consumers", async () => {
  const app = await createApp();
  let finishEmail!: () => void;
  let finishReports!: () => void;
  readiness.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishEmail = resolve;
    }),
  );
  readiness.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishReports = resolve;
    }),
  );
  try {
    const starting = app.get(QueueManager).start();
    await vi.waitFor(() => {
      expect(finishEmail).toBeTypeOf("function");
    });
    for (const transport of workers) {
      expect(transport.run).not.toHaveBeenCalled();
    }
    finishEmail();
    await vi.waitFor(() => {
      expect(finishReports).toBeTypeOf("function");
    });
    for (const transport of workers) {
      expect(transport.run).not.toHaveBeenCalled();
    }
    finishReports();
    await starting;
    for (const transport of workers) {
      expect(transport.run).toHaveBeenCalledOnce();
    }
  } finally {
    await app.close();
  }
});

it("closes all partially created transports when readiness fails", async () => {
  const app = await createApp();
  readiness.mockRejectedValue(new Error("Redis unavailable"));
  try {
    await expect(app.get(QueueManager).start()).rejects.toThrow(
      "Redis unavailable",
    );
    expect(workers.every((w) => w.run.mock.calls.length === 0)).toBe(true);
  } finally {
    await app.close();
  }
  for (const transport of workers) {
    expect(transport.close).toHaveBeenCalledOnce();
  }
});

it("closes the application while readiness is pending and never starts consumers", async () => {
  const app = await createApp();
  readiness.mockImplementation(() => new Promise<void>(() => undefined));
  const manager = app.get(QueueManager);
  const starting = manager.start(["email"]);
  await vi.waitFor(() => {
    expect(readiness).toHaveBeenCalled();
  });
  await app.close();
  await expect(starting).resolves.toEqual([]);
  expect(workers[0].run).not.toHaveBeenCalled();
  expect(workers[0].close).toHaveBeenCalledExactlyOnceWith(true);
  await expect(manager.start()).rejects.toThrow("shutting down");
});

it("notifies the foreground command when a worker loop fails", async () => {
  const app = await createApp();
  const failure = new Error("fatal consumer loop failure");
  try {
    const manager = app.get(QueueManager);
    const stopped = expect(manager.waitForStop()).rejects.toBe(failure);
    const starting = manager.start(["email"]);
    workers[0].run.mockRejectedValue(failure);
    await starting;
    await stopped;
  } finally {
    await app.close();
  }
  expect(workers[0].close).toHaveBeenCalledOnce();
});

it("closes every Worker and reader even when a Worker close fails", async () => {
  const app = await createApp(true);
  const failure = new Error("Cannot close Worker");
  const manager = app.get(QueueManager);
  await manager.start();
  workers[0].close.mockRejectedValueOnce(failure);
  await expect(manager.beforeApplicationShutdown()).rejects.toBe(failure);
  for (const worker of workers) {
    expect(worker.close).toHaveBeenCalledOnce();
  }
  expect(() => app.get(EmailProcessor).worker).toThrow("not initialized");
  expect(() => app.get(EmailQueue).queueEvents).toThrow("not initialized");
  await app.close().catch(() => undefined);
});

it("drains only selected Workers and leaves other consumers and readers running", async () => {
  const app = await createApp();
  try {
    const manager = app.get(QueueManager);
    await manager.start();
    await manager.stop(["email"]);
    expect(workers[0].close).toHaveBeenCalledOnce();
    expect(workers[1].close).not.toHaveBeenCalled();
    expect(() => app.get(EmailProcessor).worker).toThrow("not initialized");
    const closeEvents = vi.spyOn(app.get(EmailQueue).queueEvents, "close");
    expect(closeEvents).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
  expect(workers[0].close).toHaveBeenCalledOnce();
  expect(workers[1].close).toHaveBeenCalledOnce();
});

describe("Nest processor registration", () => {
  @Queue("email")
  class EmailQueue extends BaseQueue {
    readonly jobSchemas = { send: { data: z.object({}) } };
  }
  @Queue("other")
  class OtherQueue extends BaseQueue {}

  it("rejects a missing declared queue before any workers start", async () => {
    @Processor(EmailQueue)
    class EmailProcessor extends BaseProcessor {
      async processSend(_job: Job<EmailQueue, "send">) {
        await Promise.resolve();
      }
    }
    const module = await createQueueTestingModule({
      imports: [QueueModule],
      providers: [EmailProcessor],
    }).compile();
    try {
      await expect(module.init()).rejects.toThrow(
        /requires.*EmailQueue.*providers/,
      );
      expect(workers.map((worker) => worker.name)).toEqual([]);
    } finally {
      await module.close().catch(() => undefined);
    }
  });

  it.each(["factory", "value"])(
    "rejects an unregistered queue instance from a %s consumer",
    async (registration) => {
      @Processor(EmailQueue)
      class EmailProcessor extends BaseProcessor {
        async processSend(_job: Job<EmailQueue, "send">) {
          await Promise.resolve();
        }
      }
      const queue = new EmailQueue();
      const module = await createQueueTestingModule({
        imports: [QueueModule],
        providers: [
          OtherQueue,
          registration === "factory"
            ? {
                provide: EmailProcessor,
                useFactory: () => new EmailProcessor(),
              }
            : { provide: EmailProcessor, useValue: new EmailProcessor() },
        ],
      }).compile();
      try {
        await expect(module.init()).rejects.toThrow(
          /requires.*EmailQueue.*providers/,
        );
        expect(workers.map((worker) => worker.name)).toEqual([]);
      } finally {
        await module.close().catch(() => undefined);
        await queue.close();
      }
    },
  );

  it.each([
    { async: false, provider: "class" },
    { async: true, provider: "class" },
    { async: false, provider: "factory" },
    { async: true, provider: "value" },
  ])(
    "starts a registered consumer once (async=$async, provider=$provider)",
    async ({ async, provider }) => {
      @Processor(EmailQueue)
      // eslint-disable-next-line @nest-boot/queue/processor-name -- This parent fixture verifies inherited processor metadata.
      class ParentWorker extends BaseProcessor {
        async processSend(_job: Job<EmailQueue, "send">) {
          await Promise.resolve();
        }
      }
      @Processor(EmailQueue)
      class EmailProcessor extends ParentWorker {}
      const queue = new EmailQueue();
      const module = await createQueueTestingModule({
        imports: [QueueModule],
        providers: [
          provider === "value"
            ? { provide: EmailQueue, useValue: queue }
            : async
              ? {
                  provide: EmailQueue,
                  inject: [ModuleRef],
                  useFactory: async (moduleRef: ModuleRef) =>
                    await moduleRef.create(EmailQueue),
                }
              : EmailQueue,
          provider === "factory"
            ? {
                provide: EmailProcessor,
                useFactory: () => new EmailProcessor(),
              }
            : provider === "value"
              ? { provide: EmailProcessor, useValue: new EmailProcessor() }
              : EmailProcessor,
        ],
      }).compile();
      try {
        await module.init();
        await module.get(QueueManager).start();
        expect(workers.map((worker) => worker.name)).toEqual(["email"]);
      } finally {
        await module.close();
      }
    },
  );
});

it.each(["request", "transient", "bubbled", "factory"])(
  "rejects non-singleton processors before creating transports: %s",
  async (mode) => {
    @Queue("invalid")
    class TaskQueue extends BaseQueue {
      readonly jobSchemas = {
        task: { data: z.object({}), result: z.unknown() },
      };
    }
    @Injectable({ scope: mode === "bubbled" ? Scope.REQUEST : Scope.DEFAULT })
    class Dependency {}
    @Processor(TaskQueue)
    class TaskProcessor extends BaseProcessor {
      constructor(readonly dependency: Dependency) {
        super();
      }
      async processTask(_job: Job<TaskQueue, "task">) {
        await Promise.resolve();
      }
    }
    const app = await createQueueTestingModule({
      imports: [QueueModule],
      providers: [
        TaskQueue,
        Dependency,
        mode === "factory"
          ? {
              provide: TaskProcessor,
              scope: Scope.REQUEST,
              useFactory: () => new TaskProcessor(new Dependency()),
            }
          : {
              provide: TaskProcessor,
              useClass: TaskProcessor,
              scope:
                mode === "request"
                  ? Scope.REQUEST
                  : mode === "transient"
                    ? Scope.TRANSIENT
                    : Scope.DEFAULT,
            },
      ],
    }).compile();
    try {
      await expect(app.init()).rejects.toThrow("singleton BaseProcessor");
      expect(workers).toHaveLength(0);
    } finally {
      await app.close().catch(() => undefined);
    }
  },
);

it("rejects request-scoped queues before starting workers", async () => {
  @Queue("invalid")
  class TaskQueue extends BaseQueue {
    readonly jobSchemas = { task: { data: z.object({}), result: z.unknown() } };
  }
  const app = await createQueueTestingModule({
    imports: [QueueModule],
    providers: [
      { provide: TaskQueue, useClass: TaskQueue, scope: Scope.REQUEST },
    ],
  }).compile();
  try {
    await expect(app.init()).rejects.toThrow("singleton BaseQueue");
    expect(workers).toHaveLength(0);
  } finally {
    await app.close().catch(() => undefined);
  }
});
