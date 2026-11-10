import { Inject, Injectable, Optional } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { BaseQueue, Queue, QueueManager, QueueModule } from "../dist/index.js";
import { createQueueTestingModule } from "./queue-testing.fixture.js";

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
      @Optional()
      @Inject("missing")
      readonly missing?: string,
    ) {
      super({ defaultJobOptions: { attempts: settings.attempts } });
    }
  }
  @Queue("inherited")
  class Inherited extends Custom {
    constructor(
      settings: Settings,
      @Optional()
      @Inject("missing")
      missing?: string,
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
