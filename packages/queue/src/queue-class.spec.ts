import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { BaseQueue, Queue, QueueFactory, QueueModule } from "./index.js";
import { getQueueDefinition } from "./queue.decorator.js";

vi.mock("./postgres.js", async (original) => {
  const actual = await original<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  return {
    ...actual,
    PostgresQueue: class extends EventEmitter {
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
  @Queue({ name: "email", defaultJobOptions: { attempts: 3 } })
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
    imports: [QueueModule.forRoot({ connection: { host: "queue.pg" } })],
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
    connection: { host: "queue.pg" },
    defaultJobOptions: { attempts: 3 },
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
  @Queue({ name: "duplicate" })
  class SecondQueue extends BaseQueue {}
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [FirstQueue, SecondQueue],
  }).compile();
  await expect(module.init()).rejects.toThrow(/multiple providers/);
  await module.close().catch(() => undefined);
});

it("applies factory overrides without mutating queue declarations", async () => {
  @Queue({ name: "configured", defaultJobOptions: { attempts: 2 } })
  class ConfiguredQueue extends BaseQueue {}
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [
      {
        provide: ConfiguredQueue,
        inject: [QueueFactory],
        useFactory: (factory: QueueFactory) =>
          factory.create(ConfiguredQueue, {
            defaultJobOptions: { attempts: 5 },
          }),
      },
    ],
  }).compile();
  try {
    await module.init();
    expect(module.get(ConfiguredQueue).opts.defaultJobOptions).toEqual({
      attempts: 5,
    });
    expect(getQueueDefinition(ConfiguredQueue).defaultJobOptions).toEqual({
      attempts: 2,
    });
  } finally {
    await module.close();
  }
});
