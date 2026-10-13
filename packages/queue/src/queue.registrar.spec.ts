import { Test } from "@nestjs/testing";

import {
  BaseProcessor,
  BaseQueue,
  Processor,
  Queue,
  QueueEventsHost,
  QueueEventsListener,
  QueueModule,
  QueueRegistrar,
} from "./index.js";

const { workers, streams, readiness } = vi.hoisted(() => ({
  workers: [] as any[],
  streams: [] as any[],
  readiness: vi.fn(),
}));
vi.mock("./postgres.js", async () => {
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
  class Events extends Transport {
    constructor(name: string, opts: object) {
      super(name, opts);
      streams.push(this);
    }
  }
  return {
    PostgresQueue: Transport,
    PostgresWorker: Worker,
    PostgresQueueEvents: Events,
  };
});

@Queue({ name: "email" })
class EmailQueue extends BaseQueue {}
@Queue({ name: "reports" })
class ReportsQueue extends BaseQueue {}
@Processor(EmailQueue)
class EmailProcessor extends BaseProcessor {
  onQueueStart = vi.fn();
  async process() {
    await Promise.resolve();
  }
}
@Processor(ReportsQueue)
class ReportsProcessor extends EmailProcessor {}
@QueueEventsListener(EmailQueue)
class EmailEvents extends QueueEventsHost {}
@QueueEventsListener(ReportsQueue)
class ReportsEvents extends QueueEventsHost {}

/** @returns Initialized application with two declared queues. */
async function createApp() {
  const app = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [
      EmailQueue,
      ReportsQueue,
      EmailProcessor,
      ReportsProcessor,
      EmailEvents,
      ReportsEvents,
    ],
  }).compile();
  await app.init();
  return app;
}

beforeEach(() => {
  workers.length = 0;
  streams.length = 0;
  readiness.mockReset().mockResolvedValue(undefined);
});

it("keeps workers and event streams uninitialized when an application starts", async () => {
  const app = await createApp();
  try {
    expect(workers).toEqual([]);
    expect(streams).toEqual([]);
    expect(() => app.get(EmailProcessor).worker).toThrow("not initialized");
    expect(() => app.get(EmailEvents).queueEvents).toThrow("not initialized");
    expect(app.get(EmailProcessor).onQueueStart).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});

it("starts only selected consumers, listeners and their startup hooks", async () => {
  const app = await createApp();
  try {
    expect(await app.get(QueueRegistrar).start(["email", "email"])).toEqual([
      "email",
    ]);
    expect(workers.map((w) => w.name)).toEqual(["email"]);
    expect(streams.map((w) => w.name)).toEqual(["email"]);
    expect(workers[0].opts).toMatchObject({ autorun: false });
    expect(workers[0].run).toHaveBeenCalledOnce();
    expect(streams[0].run).toHaveBeenCalledOnce();
    expect(app.get(EmailProcessor).onQueueStart).toHaveBeenCalledOnce();
    expect(app.get(ReportsProcessor).onQueueStart).not.toHaveBeenCalled();
    expect(() => app.get(ReportsProcessor).worker).toThrow("not initialized");
    await expect(app.get(QueueRegistrar).start()).rejects.toThrow(
      "already been started",
    );
  } finally {
    await app.close();
  }
  expect(workers[0].close).toHaveBeenCalledOnce();
  expect(streams[0].close).toHaveBeenCalledOnce();
});

it("rejects unknown queues before creating transports and permits a corrected selection", async () => {
  const app = await createApp();
  try {
    await expect(
      app.get(QueueRegistrar).start(["email", "typo"]),
    ).rejects.toThrow('Unknown queue "typo"');
    expect(workers).toEqual([]);
    expect(streams).toEqual([]);
    await app.get(QueueRegistrar).start();
    expect(workers.map((w) => w.name)).toEqual(["email", "reports"]);
  } finally {
    await app.close();
  }
});

it.each(["readiness", "hook"])(
  "closes all partially created transports when %s fails",
  async (failure) => {
    const app = await createApp();
    if (failure === "readiness")
      readiness.mockRejectedValue(new Error("database unavailable"));
    else
      app
        .get(EmailProcessor)
        .onQueueStart.mockRejectedValue(new Error("registration failed"));
    try {
      await expect(app.get(QueueRegistrar).start()).rejects.toThrow(
        failure === "readiness"
          ? "database unavailable"
          : "registration failed",
      );
      expect(workers.every((w) => w.run.mock.calls.length === 0)).toBe(true);
      expect(() => app.get(EmailProcessor).worker).toThrow("not initialized");
    } finally {
      await app.close();
    }
    for (const transport of [...workers, ...streams])
      expect(transport.close).toHaveBeenCalledOnce();
  },
);

it.each(["readiness", "hook"])(
  "closes the application while %s is pending and never starts consumers",
  async (stage) => {
    const app = await createApp();
    if (stage === "readiness")
      readiness.mockImplementation(() => new Promise<void>(() => undefined));
    else
      app
        .get(EmailProcessor)
        .onQueueStart.mockImplementation(
          () => new Promise<void>(() => undefined),
        );
    const registrar = app.get(QueueRegistrar);
    const starting = registrar.start(["email"]);
    await vi.waitFor(() => {
      if (stage === "readiness") expect(readiness).toHaveBeenCalled();
      else expect(app.get(EmailProcessor).onQueueStart).toHaveBeenCalled();
    });
    await app.close();
    await expect(starting).resolves.toEqual([]);
    expect(workers[0].run).not.toHaveBeenCalled();
    expect(streams[0].run).not.toHaveBeenCalled();
    expect(workers[0].close).toHaveBeenCalledExactlyOnceWith(true);
    await expect(registrar.start()).rejects.toThrow("shutting down");
  },
);

it.each(["worker", "listener"])(
  "notifies the foreground command when a %s loop fails",
  async (transport) => {
    const app = await createApp();
    const failure = new Error("fatal consumer loop failure");
    app.get(EmailProcessor).onQueueStart.mockImplementation(() => {
      (transport === "worker" ? workers[0] : streams[0]).run.mockRejectedValue(
        failure,
      );
    });
    try {
      const registrar = app.get(QueueRegistrar);
      const stopped = expect(registrar.waitForStop()).rejects.toBe(failure);
      await registrar.start(["email"]);
      await stopped;
    } finally {
      await app.close();
    }
    expect(workers[0].close).toHaveBeenCalledOnce();
    expect(streams[0].close).toHaveBeenCalledOnce();
  },
);
