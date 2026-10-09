import { EventEmitter } from "node:events";

import { RequestContext } from "@nest-boot/request-context";
import { JOB_REF } from "@nestjs/bullmq";
import { Logger, SetMetadata } from "@nestjs/common";

import { OnQueueEvent, OnWorkerEvent } from "./index.js";

describe("BullMQ event request contexts", () => {
  const middlewareToken = Symbol("middleware");
  const middlewareContexts: RequestContext[] = [];
  const completedContexts: RequestContext[] = [];
  let middlewareError: Error | undefined;

  beforeAll(() => {
    RequestContext.registerMiddleware(
      "bullmq-event-tests",
      async (ctx, next) => {
        middlewareContexts.push(ctx);
        if (middlewareError) throw middlewareError;
        ctx.set(middlewareToken, ctx.id);
        await Promise.resolve();
        try {
          return await next();
        } finally {
          completedContexts.push(ctx);
        }
      },
    );
  });

  afterEach(() => {
    middlewareError = undefined;
    middlewareContexts.length = 0;
    completedContexts.length = 0;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    RequestContext.registerMiddleware(
      "bullmq-event-tests",
      async (_ctx, next) => await next(),
    );
  });

  it("creates a worker event context and binds the current job", async () => {
    const job = { id: "worker-job" };
    class Listener {
      @OnWorkerEvent("completed")
      async completed(input: typeof job, result: string, previous: string) {
        const context = RequestContext.current();
        await Promise.resolve();
        expect(RequestContext.current()).toBe(context);
        expect(context.type).toBe("queue");
        expect(context.id).toBe(input.id);
        expect(context.get(JOB_REF)).toBe(input);
        return [result, previous];
      }
    }

    await expect(
      new Listener().completed(job, "result", "active"),
    ).resolves.toEqual(["result", "active"]);
    expect(RequestContext.isActive()).toBe(false);
  });

  it("creates a queue event context without treating its payload as a Job", async () => {
    class Listener {
      @OnQueueEvent("completed")
      async completed(event: { jobId: string }, eventId: string) {
        await Promise.resolve();
        expect(RequestContext.current().type).toBe("queue");
        expect(RequestContext.id).toBe(event.jobId);
        expect(RequestContext.get(JOB_REF)).toBeUndefined();
        return eventId;
      }
    }

    await expect(
      new Listener().completed({ jobId: "queue-job" }, "123-0"),
    ).resolves.toBe("123-0");
    expect(RequestContext.isActive()).toBe(false);
  });

  it.each(["active", "completed", "failed", "progress"] as const)(
    "binds the Job for the %s worker event",
    async (eventName) => {
      class Listener {
        @OnWorkerEvent(eventName)
        async handle(_job: { id: string }) {
          await Promise.resolve();
          return RequestContext.current();
        }
      }

      const job = { id: eventName };
      const context = await new Listener().handle(job);
      expect(context?.get(JOB_REF)).toBe(job);
      expect(context?.get(middlewareToken)).toBe(job.id);
      expect(middlewareContexts).toEqual([context]);
      expect(completedContexts).toEqual([context]);
    },
  );

  it("supports failed events without a Job and stalled events with only a job ID", async () => {
    class Listener {
      @OnWorkerEvent("failed")
      async failed(_job: undefined, error: Error) {
        await Promise.resolve();
        return { context: RequestContext.current(), error };
      }

      @OnWorkerEvent("stalled")
      async stalled(_jobId: string) {
        await Promise.resolve();
        return RequestContext.current();
      }
    }

    const error = new Error("failed");
    const listener = new Listener();
    const failed = await listener.failed(undefined, error);
    const stalled = await listener.stalled("stalled-job");
    expect(failed?.error).toBe(error);
    expect(failed?.context.id).toBeTruthy();
    expect(failed?.context.get(JOB_REF)).toBeUndefined();
    expect(stalled?.id).toBe("stalled-job");
    expect(stalled?.get(JOB_REF)).toBeUndefined();
  });

  it("does not mistake lifecycle event arguments for Jobs or job IDs", async () => {
    class Listener {
      @OnWorkerEvent("ready")
      async ready() {
        await Promise.resolve();
        return RequestContext.current();
      }

      @OnWorkerEvent("closing")
      async closing(_message: string) {
        await Promise.resolve();
        return RequestContext.current();
      }

      @OnQueueEvent("drained")
      async drained(_eventId: string) {
        await Promise.resolve();
        return RequestContext.current();
      }

      @OnQueueEvent("error")
      async error(_error: Error) {
        await Promise.resolve();
        return RequestContext.current();
      }
    }

    const listener = new Listener();
    const contexts = await Promise.all([
      listener.ready(),
      listener.closing("closing-message"),
      listener.drained("stream-id"),
      listener.error(new Error("Redis error")),
    ]);
    expect(new Set(contexts.map((ctx) => ctx?.id)).size).toBe(4);
    for (const context of contexts) {
      expect(context?.type).toBe("queue");
      expect(context?.get(JOB_REF)).toBeUndefined();
      expect(context?.id).not.toBe("closing-message");
      expect(context?.id).not.toBe("stream-id");
    }
  });

  it.each([OnWorkerEvent, OnQueueEvent])(
    "isolates concurrent callbacks from each other and the emitting context (%s)",
    async (decorate) => {
      let markEntered!: () => void;
      let release!: () => void;
      const entered = new Promise<void>((resolve) => {
        markEntered = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const token = Symbol("callback-state");
      class Listener {
        readonly name = "listener";

        @decorate("completed")
        async handle(_event: { id: string; jobId: string }, value: number) {
          const context = RequestContext.current();
          const parentValue = context.get(token);
          context.set(token, value);
          if (value === 2) markEntered();
          await released;
          return {
            context,
            parentValue,
            value: RequestContext.get(token),
            name: this.name,
          };
        }
      }

      const parent = new RequestContext({ type: "http" });
      parent.set(token, "parent");
      parent.set(JOB_REF, "parent-job");
      await RequestContext.run(parent, async () => {
        const listener = new Listener();
        // Identical job IDs can still represent separate event callbacks.
        const event = { id: "same-job", jobId: "same-job" };
        const first = listener.handle(event, 1);
        const second = listener.handle(event, 2);
        await entered;
        expect(completedContexts).toHaveLength(0);
        release();
        const [a, b] = await Promise.all([first, second]);
        expect(a?.context).not.toBe(b?.context);
        expect(a?.context).not.toBe(parent);
        expect(a?.context.parent).toBeUndefined();
        expect(a?.parentValue).toBeUndefined();
        expect(b?.parentValue).toBeUndefined();
        expect(a?.value).toBe(1);
        expect(b?.value).toBe(2);
        expect(a?.name).toBe("listener");
        expect(RequestContext.current()).toBe(parent);
        expect(RequestContext.get(token)).toBe("parent");
        expect(completedContexts).toHaveLength(2);
      });
      expect(RequestContext.isActive()).toBe(false);
    },
  );

  it.each([OnWorkerEvent, OnQueueEvent])(
    "preserves method metadata and inherited handlers without rewrapping (%s)",
    async (decorate) => {
      const before = Symbol("before");
      const after = Symbol("after");
      class BaseListener {
        @SetMetadata(after, "outer")
        @decorate("completed")
        @SetMetadata(before, "inner")
        async handle() {
          await Promise.resolve();
          return RequestContext.current();
        }
      }
      class Listener extends BaseListener {}

      const listener = new Listener();
      const method = Object.getOwnPropertyDescriptor(
        BaseListener.prototype,
        "handle",
      )?.value;
      expect(Reflect.getMetadata(before, method)).toBe("inner");
      expect(Reflect.getMetadata(after, method)).toBe("outer");
      const context = await listener.handle();
      expect(context?.type).toBe("queue");
      expect(middlewareContexts).toEqual([context]);
    },
  );

  it.each([OnWorkerEvent, OnQueueEvent])(
    "logs synchronous and asynchronous failures without rejecting event dispatch (%s)",
    async (decorate) => {
      const log = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      class Listener {
        @decorate("completed")
        sync() {
          throw new Error("synchronous failure");
        }

        @decorate("error")
        async async() {
          await Promise.resolve();
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exercise non-Error rejection handling.
          return await Promise.reject("asynchronous failure");
        }
      }
      const listener = new Listener();
      const emitter = new EventEmitter();
      emitter.on("completed", listener.sync.bind(listener));
      emitter.on("error", () => {
        void listener.async();
      });
      expect(emitter.emit("completed")).toBe(true);
      expect(emitter.emit("error", new Error("original event"))).toBe(true);
      await vi.waitFor(() => {
        expect(log).toHaveBeenCalledTimes(2);
      });
      expect(log).toHaveBeenCalledWith(
        "BullMQ event handler failed (completed): synchronous failure",
        expect.any(String),
      );
      expect(log).toHaveBeenCalledWith(
        "BullMQ event handler failed (error): asynchronous failure",
        undefined,
      );
      expect(RequestContext.isActive()).toBe(false);
    },
  );

  it("logs middleware failures before an event callback can start", async () => {
    const log = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const called = vi.fn();
    class Listener {
      @OnQueueEvent("completed")
      async handle() {
        await Promise.resolve();
        called();
      }
    }
    middlewareError = new Error("middleware failure");

    await expect(new Listener().handle()).resolves.toBeUndefined();
    expect(called).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "BullMQ event handler failed (completed): middleware failure",
      expect.any(String),
    );
    expect(RequestContext.isActive()).toBe(false);
  });
});
