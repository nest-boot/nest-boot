import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { Inject, Injectable, Module, Scope } from "@nestjs/common";
import { ContextIdFactory } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { Job } from "bullmq";

import {
  BaseProcessor,
  BaseQueue,
  JOB_REF,
  OnWorkerEvent,
  Processor,
  Queue,
  QueueModule,
  QueueRegistrar,
} from "./index.js";

const { workers } = vi.hoisted(() => ({ workers: [] as any[] }));
vi.mock("./postgres.js", async (original) => {
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
  return { ...actual, PostgresQueue: Transport, PostgresWorker: Worker };
});

afterEach(() => {
  workers.length = 0;
  vi.restoreAllMocks();
});

it.each(["singleton", "request", "bubbled", "transient"])(
  "resolves %s consumers with isolated job contexts",
  async (mode) => {
    @Queue({
      name: "scope",
      connection: { host: "queue-host" },
    })
    class TaskQueue extends BaseQueue {}
    @Injectable({ scope: mode === "bubbled" ? Scope.REQUEST : Scope.DEFAULT })
    class Dependency {
      readonly id = Symbol();
    }
    let created = 0;
    const events = vi.fn();
    @Processor(TaskQueue, {
      scope:
        mode === "request"
          ? Scope.REQUEST
          : mode === "transient"
            ? Scope.TRANSIENT
            : Scope.DEFAULT,
    })
    class Consumer extends BaseProcessor {
      readonly id = ++created;
      constructor(readonly dependency: Dependency) {
        super();
      }
      onQueueStart() {
        expect(mode).toBe("singleton");
      }
      async process(job: Job, token?: string, signal?: AbortSignal) {
        const context = RequestContext.current();
        await Promise.resolve();
        expect(RequestContext.current()).toBe(context);
        expect(context.get(JOB_REF)).toBe(job);
        return { consumer: this, context, token, signal, worker: this.worker };
      }
      @OnWorkerEvent("completed")
      completed() {
        events();
      }
    }
    const module = await Test.createTestingModule({
      imports: [QueueModule],
      providers: [TaskQueue, Dependency, Consumer],
    }).compile();
    try {
      await module.init();
      await module.get(QueueRegistrar).start();
      expect(workers).toHaveLength(1);
      const [worker] = workers;
      expect(worker.opts).toMatchObject({
        connection: { host: "queue-host" },
      });
      const signal = new AbortController().signal;
      const [first, second] = await Promise.all([
        worker.processJob({ id: "1" }, "one", signal),
        worker.processJob({ id: "2" }, "two"),
      ]);
      expect(first.context).not.toBe(second.context);
      expect(first.token).toBe("one");
      expect(first.signal).toBe(signal);
      expect(first.worker).toBe(worker);
      expect(second.worker).toBe(worker);
      if (mode === "singleton") expect(first.consumer).toBe(second.consumer);
      else expect(first.consumer).not.toBe(second.consumer);
      if (mode === "bubbled")
        expect(first.consumer.dependency).not.toBe(second.consumer.dependency);
      worker.emit("completed", { id: "1" });
      await Promise.resolve();
      expect(events).toHaveBeenCalledTimes(mode === "singleton" ? 1 : 0);
    } finally {
      await module.close();
    }
    expect(workers[0].close).toHaveBeenCalledOnce();
  },
);

it("injects JOB_REF and respects durable context strategies", async () => {
  @Queue({ name: "durable" })
  class TaskQueue extends BaseQueue {}
  @Injectable({ scope: Scope.REQUEST, durable: true })
  class TenantState {
    readonly id = Symbol();
  }
  @Processor(TaskQueue)
  class Consumer extends BaseProcessor {
    constructor(
      readonly tenant: TenantState,
      @Inject(JOB_REF) readonly injectedJob: Job,
      readonly context: RequestContext,
    ) {
      super();
    }
    async process(job: Job) {
      await Promise.resolve();
      expect(this.injectedJob).toBe(job);
      expect(this.context).toBe(RequestContext.current());
      return { consumer: this, tenant: this.tenant };
    }
  }
  const parent = ContextIdFactory.create();
  const normalGetByRequest =
    ContextIdFactory.getByRequest.bind(ContextIdFactory);
  const getContext = vi
    .spyOn(ContextIdFactory, "getByRequest")
    .mockImplementation((job) => {
      const context = normalGetByRequest(job);
      context.getParent = ({ isTreeDurable }) =>
        isTreeDurable ? parent : context;
      return context;
    });
  const module = await Test.createTestingModule({
    imports: [QueueModule, RequestContextModule],
    providers: [TaskQueue, TenantState, Consumer],
  }).compile();
  try {
    await module.init();
    await module.get(QueueRegistrar).start();
    const a = await workers[0].processJob({ id: "a" });
    const b = await workers[0].processJob({ id: "b" });
    expect(a.consumer).not.toBe(b.consumer);
    expect(a.tenant).toBe(b.tenant);
    expect(getContext).toHaveBeenCalledTimes(2);
  } finally {
    await module.close();
  }
});

it("resolves a scoped consumer from its declaring module", async () => {
  @Queue({ name: "local" })
  class TaskQueue extends BaseQueue {}
  @Processor(TaskQueue, { scope: Scope.REQUEST })
  class Consumer extends BaseProcessor {
    constructor(@Inject("LABEL") readonly label: string) {
      super();
    }
    async process() {
      await Promise.resolve();
      return this.label;
    }
  }
  @Module({
    imports: [QueueModule],
    providers: [TaskQueue],
    exports: [TaskQueue],
  })
  class Queues {}
  @Module({
    imports: [Queues],
    providers: [Consumer, { provide: "LABEL", useValue: "first" }],
  })
  class First {}
  @Module({
    imports: [Queues],
    providers: [Consumer, { provide: "LABEL", useValue: "second" }],
  })
  class Second {}
  const module = await Test.createTestingModule({
    imports: [First, Second],
  }).compile();
  try {
    await module.init();
    await module.get(QueueRegistrar).start();
    expect(
      await Promise.all(
        workers.map(async (worker) => await worker.processJob({ id: "job" })),
      ),
    ).toEqual(["first", "second"]);
  } finally {
    await module.close();
  }
});

it("rejects request-scoped queues before starting workers", async () => {
  @Queue({ name: "invalid" })
  class TaskQueue extends BaseQueue {}
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [
      { provide: TaskQueue, useClass: TaskQueue, scope: Scope.REQUEST },
    ],
  }).compile();
  await expect(module.init()).rejects.toThrow(/singleton BaseQueue/);
  expect(workers).toHaveLength(0);
  await module.close().catch(() => undefined);
});

it("resolves request-scoped factory consumers once per job", async () => {
  @Queue({ name: "factory-scope" })
  class TaskQueue extends BaseQueue {}
  @Processor(TaskQueue)
  class Consumer extends BaseProcessor {
    constructor(readonly job: Job) {
      super();
    }
    async process(job: Job) {
      await Promise.resolve();
      expect(job).toBe(this.job);
      return this;
    }
  }
  const create = vi.fn((job: Job) => new Consumer(job));
  const module = await Test.createTestingModule({
    imports: [QueueModule],
    providers: [
      TaskQueue,
      {
        provide: Consumer,
        scope: Scope.REQUEST,
        inject: [JOB_REF],
        useFactory: create,
      },
    ],
  }).compile();
  try {
    await module.init();
    await module.get(QueueRegistrar).start();
    expect(create).not.toHaveBeenCalled();
    const [first, second] = await Promise.all([
      workers[0].processJob({ id: "first" }),
      workers[0].processJob({ id: "second" }),
    ]);
    expect(first).not.toBe(second);
    expect(create).toHaveBeenCalledTimes(2);
  } finally {
    await module.close();
  }
});

it("binds workers to runtime queue names across independent applications", async () => {
  @Queue({ name: "schedule", expose: true })
  class ApplicationQueue extends BaseQueue {
    constructor(@Inject("APP_QUEUE_NAME") name: string) {
      super({}, name);
    }
  }
  @Processor(ApplicationQueue, { autorun: false })
  class Consumer extends BaseProcessor {
    async process() {
      await Promise.resolve();
    }
  }
  const modules = [];
  try {
    for (const name of ["billing-schedule", "reporting-schedule"]) {
      const module = await Test.createTestingModule({
        imports: [QueueModule],
        providers: [
          ApplicationQueue,
          Consumer,
          { provide: "APP_QUEUE_NAME", useValue: name },
        ],
      }).compile();
      modules.push(module);
      await module.init();
      await module.get(QueueRegistrar).start();
      expect(module.get(ApplicationQueue).name).toBe(name);
      expect(module.get(Consumer).worker.name).toBe(name);
    }
    expect(workers.map((worker) => worker.name)).toEqual([
      "billing-schedule",
      "reporting-schedule",
    ]);
  } finally {
    await Promise.all(modules.map((module) => module.close()));
  }
});
