import { Inject, Injectable, Optional } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { Job as BullmqJob } from "bullmq";
import { z } from "zod";

import { createQueueTestingModule } from "../../test/queue-testing.fixture.js";
import {
  BaseQueue,
  type Job,
  type JobSchemas,
  Queue,
  QueueManager,
  QueueModule,
} from "../index.js";

const { nativeAdd, nativeBulk, nativeScheduler } = vi.hoisted(() => ({
  nativeAdd: vi.fn((name: string, data: unknown) =>
    Promise.resolve({ name, data }),
  ),
  nativeBulk: vi.fn((jobs: unknown[]) => Promise.resolve(jobs)),
  nativeScheduler: vi.fn((_id: string, _repeat: unknown, template: unknown) =>
    Promise.resolve(template),
  ),
}));

vi.mock("bullmq", async (original) => {
  const actual = await original<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  return {
    ...actual,
    QueueEvents: class extends EventEmitter {
      close = vi.fn().mockResolvedValue(undefined);
      run = vi.fn().mockResolvedValue(undefined);
      waitUntilReady = vi.fn().mockResolvedValue(undefined);
    },
    Queue: class extends EventEmitter {
      async add(name: string, data: unknown) {
        return await nativeAdd(name, data);
      }
      async addBulk(jobs: unknown[]) {
        return await nativeBulk(jobs);
      }
      async upsertJobScheduler(id: string, repeat: unknown, template: unknown) {
        return await nativeScheduler(id, repeat, template);
      }
      close = vi.fn().mockResolvedValue(undefined);
      constructor(
        readonly name: string,
        readonly opts: object,
      ) {
        super();
      }
    },
  };
});

it("uses a static declaration and constructor settings, and reuses the injected queue", async () => {
  @Queue("email")
  class EmailQueue extends BaseQueue {
    constructor() {
      super({
        connection: { host: "redis" },
        defaultJobOptions: { attempts: 3 },
      });
    }
  }
  @Injectable()
  class Sender {
    constructor(readonly queue: EmailQueue) {}
  }
  const app = await createQueueTestingModule({
    imports: [QueueModule],
    providers: [
      EmailQueue,
      Sender,
      { provide: "alias", useExisting: EmailQueue },
    ],
  }).compile();
  const close = vi.spyOn(app.get(EmailQueue), "close");
  try {
    await app.init();
    const queue = app.get(EmailQueue);
    expect(app.get(Sender).queue).toBe(queue);
    expect(queue.name).toBe("email");
    expect(queue.opts).toMatchObject({
      connection: { host: "redis" },
      defaultJobOptions: { attempts: 3 },
    });
  } finally {
    await app.close();
  }
  expect(close).toHaveBeenCalledOnce();
});

it("uses REDIS_URL by default and supports direct construction", async () => {
  vi.stubEnv("REDIS_URL", "redis://localhost:6381/2");
  try {
    @Queue("email")
    class EmailQueue extends BaseQueue {}
    const queue = new EmailQueue();
    expect(queue.opts.connection).toMatchObject({
      host: "localhost",
      port: 6381,
      db: 2,
    });
    await queue.close();
  } finally {
    vi.unstubAllEnvs();
  }
});

it("requires every concrete queue to declare its own name", () => {
  class Undeclared extends BaseQueue {}
  @Queue("parent")
  class Parent extends BaseQueue {}
  class Child extends Parent {}
  expect(() => new Undeclared()).toThrow("@Queue()");
  expect(() => new Child()).toThrow("@Queue()");
});

it("discovers singleton queues once and passes the validated list to event synchronization", async () => {
  @Queue("public")
  class PublicQueue extends BaseQueue {}
  @Queue("internal")
  class InternalQueue extends BaseQueue {}
  const app = await createQueueTestingModule({
    imports: [QueueModule],
    providers: [
      {
        provide: PublicQueue,
        inject: [ModuleRef],
        useFactory: async (ref: ModuleRef) => await ref.create(PublicQueue),
      },
      { provide: "alias", useExisting: PublicQueue },
      InternalQueue,
    ],
  }).compile();
  try {
    await app.init();
    const queues = app.get(QueueManager).getQueues();
    expect(queues).toHaveLength(2);
    expect(queues).toEqual(
      expect.arrayContaining([app.get(PublicQueue), app.get(InternalQueue)]),
    );
    expect(queues.every((queue) => queue.queueEvents)).toBe(true);
  } finally {
    await app.close();
  }
});

it("preserves normal inherited DI and optional business dependencies", async () => {
  @Injectable()
  class Settings {
    attempts = 7;
  }
  @Queue("custom")
  class Custom extends BaseQueue {
    constructor(
      readonly settings: Settings,
      @Optional() @Inject("missing") readonly missing?: string,
    ) {
      super({ defaultJobOptions: { attempts: settings.attempts } });
    }
  }
  @Queue("inherited")
  class Inherited extends Custom {
    constructor(
      settings: Settings,
      @Optional() @Inject("missing") missing?: string,
    ) {
      super(settings, missing);
    }
  }
  const app = await createQueueTestingModule({
    imports: [QueueModule],
    providers: [Settings, Custom, Inherited],
  }).compile();
  try {
    await app.init();
    expect(app.get(Inherited).settings).toBe(app.get(Settings));
    expect(app.get(Inherited).missing).toBeUndefined();
    expect(app.get(Inherited).opts.defaultJobOptions).toEqual({ attempts: 7 });
    expect(app.get(Inherited).name).toBe("inherited");
  } finally {
    await app.close();
  }
});

it.each(["duplicate", "job"])(
  "rejects conflicting queue declarations: %s",
  async (name) => {
    @Queue(name)
    class First extends BaseQueue {}
    @Queue(name)
    class Second extends BaseQueue {}
    const app = await createQueueTestingModule({
      imports: [QueueModule],
      providers: [First, Second],
    }).compile();
    try {
      await expect(app.init()).rejects.toThrow("multiple providers");
    } finally {
      await app.close().catch(() => undefined);
    }
  },
);

it("derives omitted names by stripping the Queue suffix and converting to kebab-case", async () => {
  @Queue()
  class EmailQueue extends BaseQueue {}
  @Queue()
  class JobQueue extends BaseQueue {}
  @Queue("")
  class HTTPQueue extends BaseQueue {}
  @Queue("custom-name")
  class CustomQueue extends BaseQueue {}
  const queues = [
    new EmailQueue(),
    new JobQueue(),
    new HTTPQueue(),
    new CustomQueue(),
  ];
  try {
    expect(queues.map((queue) => queue.name)).toEqual([
      "email",
      "job",
      "http",
      "custom-name",
    ]);
  } finally {
    await Promise.all(queues.map((queue) => queue.close()));
  }
});

describe("inferred job contracts", () => {
  @Queue()
  class EmailQueue extends BaseQueue {
    readonly jobSchemas = {
      send: {
        data: z.object({ to: z.email(), subject: z.string() }),
        result: z.object({ messageId: z.string() }),
      },
      welcome: { data: z.object({ userId: z.string() }) },
      length: {
        data: z.object({ text: z.string().transform((text) => text.length) }),
        result: z.number(),
      },
      original: {
        data: z.object({
          count: z.coerce.number(),
          label: z.string().default("default"),
        }),
        result: z.object({
          count: z.coerce.number(),
          label: z.string().default("default"),
        }),
      },
      async: {
        data: z.object({
          value: z
            .string()
            .refine(async (value) => await Promise.resolve(value === "valid")),
        }),
      },
    };
  }
  let queue: EmailQueue;
  beforeEach(() => {
    queue = new EmailQueue();
    vi.clearAllMocks();
  });
  afterEach(async () => {
    await queue.close();
  });

  it("infers names, input data, results and narrowed Processor jobs from the instance property", async () => {
    const job = await queue.add("send", {
      to: "user@example.com",
      subject: "Hello",
    });
    expectTypeOf(job).toEqualTypeOf<
      BullmqJob<{ to: string; subject: string }, { messageId: string }, "send">
    >();
    const welcome = await queue.add("welcome", { userId: "123" });
    expectTypeOf(welcome.returnvalue).toEqualTypeOf<ReturnType<() => void>>();
    const length = await queue.add("length", { text: "hello" });
    expectTypeOf(length.data.text).toEqualTypeOf<string>();
    const processorJob = {} as Job<EmailQueue>;
    if (processorJob.name === "send") {
      expectTypeOf(processorJob.data).toEqualTypeOf<{
        to: string;
        subject: string;
      }>();
    }
    if (processorJob.name === "length") {
      expectTypeOf(processorJob.data.text).toEqualTypeOf<string>();
    }
    expectTypeOf<{
      invalid: { data: z.ZodString };
    }>().not.toExtend<JobSchemas>();
    expectTypeOf<{
      invalid: { result: z.ZodString };
    }>().not.toExtend<JobSchemas>();

    // eslint-disable-next-line no-constant-condition -- Validate rejected types without executing invalid jobs.
    if (false) {
      // @ts-expect-error Only declared names are accepted.
      void queue.add("unknown", {});
      // @ts-expect-error The send payload cannot use the welcome shape.
      void queue.add("send", { userId: "123" });
      const name = Math.random() ? "send" : "welcome";
      // @ts-expect-error A union name cannot be paired with an unrelated single payload.
      void queue.add(name, { userId: "123" });
      // @ts-expect-error Bulk names and data remain correlated.
      void queue.addBulk([{ name: "send", data: { userId: "123" } }]);
      void queue.upsertJobScheduler(
        "daily",
        { every: 1000 },
        // @ts-expect-error Scheduled job names and data remain correlated.
        { name: "send", data: { userId: "123" } },
      );
      // @ts-expect-error Typed schedulers require a job template.
      void queue.upsertJobScheduler("daily", { every: 1000 });
    }
    expect(job.name).toBe("send");
  });

  it("rejects invalid payloads and unknown names before native enqueue", async () => {
    await expect(
      queue.add("send", { to: "invalid", subject: "Hello" }),
    ).rejects.toThrow();
    await expect(
      queue.add("missing" as "welcome", { userId: "123" }),
    ).rejects.toThrow('Unknown job "missing"');
    await expect(
      queue.add("toString" as "welcome", { userId: "123" }),
    ).rejects.toThrow('Unknown job "toString"');
    expect(nativeAdd).not.toHaveBeenCalled();
  });

  it("validates every bulk entry before writing any of them", async () => {
    await expect(
      queue.addBulk([
        { name: "welcome", data: { userId: "123" } },
        { name: "send", data: { to: "invalid", subject: "Hello" } },
      ]),
    ).rejects.toThrow();
    expect(nativeBulk).not.toHaveBeenCalled();
    const jobs = await queue.addBulk([
      { name: "send", data: { to: "user@example.com", subject: "Hello" } },
      { name: "welcome", data: { userId: "123" } },
    ]);
    expect(jobs.map((job) => job.name)).toEqual(["send", "welcome"]);
  });

  it("validates scheduler templates while keeping scheduler IDs independent of job names", async () => {
    await queue.upsertJobScheduler(
      "daily-welcome",
      { every: 1000 },
      { name: "welcome", data: { userId: "123" } },
    );
    expect(nativeScheduler).toHaveBeenCalledExactlyOnceWith(
      "daily-welcome",
      { every: 1000 },
      { name: "welcome", data: { userId: "123" } },
    );
    await expect(
      queue.upsertJobScheduler(
        "daily-send",
        { every: 1000 },
        { name: "send", data: { to: "invalid", subject: "Hello" } },
      ),
    ).rejects.toThrow();
    expect(nativeScheduler).toHaveBeenCalledOnce();
  });

  it("preserves the original input when validating a schema with transforms", async () => {
    const data = { text: "hello" };
    const job = await queue.add("length", data);
    expect(job.data).toBe(data);
    expect(job.data.text).toBe("hello");
    await expect(
      queue.validateJobData("length", job.data),
    ).resolves.toBeUndefined();
    expect(job.data).toBe(data);
    expect(job.data).toEqual({ text: "hello" });
  });

  it("awaits asynchronous validation before enqueueing", async () => {
    await expect(queue.add("async", { value: "invalid" })).rejects.toThrow();
    expect(nativeAdd).not.toHaveBeenCalled();
    await queue.add("async", { value: "valid" });
    expect(nativeAdd).toHaveBeenCalledOnce();
  });

  it("discards parsed defaults, coercions and stripped fields for data and results", async () => {
    const data = { count: "12", extra: "keep" };
    const job = await queue.add("original", data);
    await queue.validateJobData("original", data);
    await queue.validateJobResult("original", data);
    expect(job.data).toBe(data);
    expect(data).toEqual({ count: "12", extra: "keep" });
  });
});

it("rejects conflicting method names at compile time and when schemas are initialized or submitted", async () => {
  // @ts-expect-error Both names require processSendEmail.
  @Queue()
  class ConflictingQueue extends BaseQueue {
    readonly jobSchemas = {
      "send-email": { data: z.object({}) },
      sendEmail: { data: z.object({}) },
    };
  }
  const queue = new ConflictingQueue();
  try {
    expect(() => {
      queue.onModuleInit();
    }).toThrow("both map to processSendEmail");
    nativeAdd.mockClear();
    await expect(queue.add("send-email", {})).rejects.toThrow(
      "both map to processSendEmail",
    );
    expect(nativeAdd).not.toHaveBeenCalled();
  } finally {
    await queue.close();
  }
});
