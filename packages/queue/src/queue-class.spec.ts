import { Inject, Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import {
  BaseQueue,
  Queue,
  QUEUE_MODULE_OPTIONS,
  QueueModule,
  type QueueModuleOptions,
} from "./index.js";
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
    imports: [
      QueueModule.forRootAsync({
        useFactory: async () =>
          await Promise.resolve({
            connection: { host: "queue.pg" },
            defaultJobOptions: { attempts: 1 },
          }),
      }),
    ],
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

it("defaults names to kebab-case and accepts options without a name", async () => {
  @Queue()
  class EmailQueue extends BaseQueue {}
  @Queue({ defaultJobOptions: { attempts: 4 } })
  class ReportsQueue extends EmailQueue {}
  @Queue()
  class HTTPQueue extends BaseQueue {}
  @Queue({ name: "CustomUploads" })
  class UploadQueue extends BaseQueue {}
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [EmailQueue, ReportsQueue, HTTPQueue, UploadQueue],
  }).compile();
  try {
    await module.init();
    expect(module.get(EmailQueue).name).toBe("email-queue");
    expect(module.get(ReportsQueue).name).toBe("reports-queue");
    expect(module.get(HTTPQueue).name).toBe("http-queue");
    expect(module.get(ReportsQueue).opts.defaultJobOptions).toEqual({
      attempts: 4,
    });
    expect(module.get(UploadQueue).name).toBe("CustomUploads");
  } finally {
    await module.close();
  }
});

it("allows queue classes to inject their own dependencies", async () => {
  @Injectable()
  class Settings {
    readonly label = "configured";
  }
  @Queue({ name: "custom" })
  class CustomQueue extends BaseQueue {
    constructor(
      @Inject(QUEUE_MODULE_OPTIONS) options: QueueModuleOptions,
      readonly settings: Settings,
    ) {
      super(options);
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

it("merges constructor overrides over declarations and asynchronous defaults", async () => {
  @Queue({ name: "configured", defaultJobOptions: { attempts: 2 } })
  class ConfiguredQueue extends BaseQueue {
    constructor(@Inject(QUEUE_MODULE_OPTIONS) options: QueueModuleOptions) {
      super(options, { defaultJobOptions: { attempts: 5 } });
    }
  }
  const defaults = {
    connection: { host: "queue.pg" },
    defaultJobOptions: { attempts: 1 },
    graphql: false,
    getJobReadFilter: () => ({}),
  };
  const module = await Test.createTestingModule({
    imports: [
      QueueModule.forRootAsync({
        useFactory: async () => await Promise.resolve(defaults),
      }),
    ],
    providers: [ConfiguredQueue],
  }).compile();
  try {
    await module.init();
    expect(module.get(ConfiguredQueue).opts.defaultJobOptions).toEqual({
      attempts: 5,
    });
    expect(getQueueDefinition(ConfiguredQueue).defaultJobOptions).toEqual({
      attempts: 2,
    });
    expect(defaults.defaultJobOptions).toEqual({ attempts: 1 });
    expect(module.get(ConfiguredQueue).opts.connection).toEqual({
      host: "queue.pg",
    });
    expect(module.get(ConfiguredQueue).opts).not.toHaveProperty("graphql");
    expect(module.get(ConfiguredQueue).opts).not.toHaveProperty(
      "getJobReadFilter",
    );
  } finally {
    await module.close();
  }
});

it("preserves custom and inherited constructor dependencies", async () => {
  @Injectable()
  class Settings {
    readonly attempts = 7;
  }
  @Queue({ name: "parent" })
  class ParentQueue extends BaseQueue {}
  @Queue({ name: "custom" })
  class CustomQueue extends ParentQueue {
    constructor(
      readonly settings: Settings,
      @Inject(QUEUE_MODULE_OPTIONS) options: QueueModuleOptions,
    ) {
      super(options, { defaultJobOptions: { attempts: settings.attempts } });
    }
  }
  @Queue({ name: "inherited" })
  class InheritedQueue extends CustomQueue {}
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [Settings, CustomQueue, InheritedQueue],
  }).compile();
  try {
    await module.init();
    expect(module.get(CustomQueue).settings).toBe(module.get(Settings));
    expect(module.get(InheritedQueue).settings).toBe(module.get(Settings));
    expect(module.get(InheritedQueue).opts.defaultJobOptions).toEqual({
      attempts: 7,
    });
  } finally {
    await module.close();
  }
});
