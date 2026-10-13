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
@Processor(EmailQueue, { concurrency: 2 })
class EmailProcessor extends BaseProcessor {
  constructor() {
    super({ concurrency: 4 });
  }
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
  } finally {
    await app.close();
  }
});

it("starts only selected consumers and listeners", async () => {
  const app = await createApp();
  try {
    expect(await app.get(QueueRegistrar).start(["email", "email"])).toEqual([
      "email",
    ]);
    expect(workers.map((w) => w.name)).toEqual(["email"]);
    expect(streams.map((w) => w.name)).toEqual(["email"]);
    expect(workers[0].opts).toMatchObject({ autorun: false, concurrency: 4 });
    expect(workers[0].run).toHaveBeenCalledOnce();
    expect(streams[0].run).toHaveBeenCalledOnce();
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
    const starting = app.get(QueueRegistrar).start();
    await vi.waitFor(() => {
      expect(finishEmail).toBeTypeOf("function");
    });
    for (const transport of [...workers, ...streams])
      expect(transport.run).not.toHaveBeenCalled();
    finishEmail();
    await vi.waitFor(() => {
      expect(finishReports).toBeTypeOf("function");
    });
    for (const transport of [...workers, ...streams])
      expect(transport.run).not.toHaveBeenCalled();
    finishReports();
    await starting;
    for (const transport of [...workers, ...streams])
      expect(transport.run).toHaveBeenCalledOnce();
  } finally {
    await app.close();
  }
});

it("closes all partially created transports when readiness fails", async () => {
  const app = await createApp();
  readiness.mockRejectedValue(new Error("database unavailable"));
  try {
    await expect(app.get(QueueRegistrar).start()).rejects.toThrow(
      "database unavailable",
    );
    expect(workers.every((w) => w.run.mock.calls.length === 0)).toBe(true);
    expect(() => app.get(EmailProcessor).worker).toThrow("not initialized");
  } finally {
    await app.close();
  }
  for (const transport of [...workers, ...streams])
    expect(transport.close).toHaveBeenCalledOnce();
});

it("closes the application while readiness is pending and never starts consumers", async () => {
  const app = await createApp();
  readiness.mockImplementation(() => new Promise<void>(() => undefined));
  const registrar = app.get(QueueRegistrar);
  const starting = registrar.start(["email"]);
  await vi.waitFor(() => {
    expect(readiness).toHaveBeenCalled();
  });
  await app.close();
  await expect(starting).resolves.toEqual([]);
  expect(workers[0].run).not.toHaveBeenCalled();
  expect(streams[0].run).not.toHaveBeenCalled();
  expect(workers[0].close).toHaveBeenCalledExactlyOnceWith(true);
  await expect(registrar.start()).rejects.toThrow("shutting down");
});

it.each(["worker", "listener"])(
  "notifies the foreground command when a %s loop fails",
  async (transport) => {
    const app = await createApp();
    const failure = new Error("fatal consumer loop failure");
    try {
      const registrar = app.get(QueueRegistrar);
      const stopped = expect(registrar.waitForStop()).rejects.toBe(failure);
      const starting = registrar.start(["email"]);
      (transport === "worker" ? workers[0] : streams[0]).run.mockRejectedValue(
        failure,
      );
      await starting;
      await stopped;
    } finally {
      await app.close();
    }
    expect(workers[0].close).toHaveBeenCalledOnce();
    expect(streams[0].close).toHaveBeenCalledOnce();
  },
);
