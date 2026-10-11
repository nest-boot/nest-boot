import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { BaseQueue, Queue, QueueFactory, QueueModule } from "./index.js";
import { JOB_SERVICE } from "./queue.constants.js";
import { getQueueDefinition } from "./queue.decorator.js";

vi.mock("bullmq", async (original) => {
  const actual = await original<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  return {
    ...actual,
    Queue: class extends EventEmitter {
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

it("injects a declared queue class and closes its single instance", async () => {
  @Queue({ name: "email", prefix: "email-prefix" })
  class EmailQueue extends BaseQueue {
    label() {
      return this.name;
    }
  }
  @Injectable()
  class Sender {
    constructor(readonly queue: EmailQueue) {}
  }
  const module = await Test.createTestingModule({
    imports: [QueueModule.forRoot({ connection: { host: "queue.redis" } })],
    providers: [
      EmailQueue,
      Sender,
      { provide: "ALIAS", useExisting: EmailQueue },
    ],
  }).compile();
  await module.init();
  const queue = module.get(EmailQueue);
  expect(module.get(Sender).queue).toBe(queue);
  expect(queue.label()).toBe("email");
  expect(queue.opts).toMatchObject({
    connection: { host: "queue.redis" },
    prefix: "email-prefix",
  });
  const close = vi.spyOn(queue, "close");
  await module.close();
  expect(close).toHaveBeenCalledOnce();
});

it("allows queue classes to inject their own dependencies", async () => {
  @Injectable()
  class Settings {
    readonly label = "configured";
  }
  @Queue({ name: "custom" })
  class CustomQueue extends BaseQueue {
    constructor(
      factory: QueueFactory,
      readonly settings: Settings,
    ) {
      super(factory);
    }
  }
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [Settings, CustomQueue],
  }).compile();
  try {
    await module.init();
    expect(module.get(CustomQueue).settings.label).toBe("configured");
  } finally {
    await module.close();
  }
});

it("rejects conflicting queue providers before starting consumers", async () => {
  @Queue({ name: "duplicate" })
  class FirstQueue extends BaseQueue {}
  @Queue({ name: "duplicate", prefix: "other" })
  class SecondQueue extends BaseQueue {}
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [FirstQueue, SecondQueue],
  }).compile();
  await expect(module.init()).rejects.toThrow(/multiple providers/);
  await module.close().catch(() => undefined);
});

it("merges persistence overrides without mutating the declared configuration", async () => {
  @Queue({ name: "inherited", persistence: { enabled: true, ttl: 10 } })
  class InheritedQueue extends BaseQueue {}
  @Queue({ name: "disabled", persistence: { enabled: true, ttl: 10 } })
  class DisabledQueue extends BaseQueue {}
  const observer = { registerQueue: vi.fn() };
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [
      {
        provide: InheritedQueue,
        inject: [QueueFactory],
        useFactory: (factory: QueueFactory) =>
          factory.create(InheritedQueue, { persistence: { ttl: 20 } }),
      },
      {
        provide: DisabledQueue,
        inject: [QueueFactory],
        useFactory: (factory: QueueFactory) =>
          factory.create(DisabledQueue, { persistence: { enabled: false } }),
      },
    ],
  })
    .overrideProvider(JOB_SERVICE)
    .useValue(observer)
    .compile();
  try {
    await module.init();
    expect(observer.registerQueue).toHaveBeenCalledExactlyOnceWith(
      module.get(InheritedQueue),
      20,
    );
    expect(module.get(InheritedQueue).opts).not.toHaveProperty("persistence");
    expect(getQueueDefinition(InheritedQueue).persistence).toEqual({
      enabled: true,
      ttl: 10,
    });
  } finally {
    await module.close();
  }
});
