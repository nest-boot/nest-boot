import { QueueHealthIndicator } from "./queue.health-indicator.js";
import type { QueueManager } from "./queue.manager.js";
import { BaseQueue } from "./queues/base.queue.js";

describe("QueueHealthIndicator", () => {
  /**
   * Returns queue configured for the test.
   * @param name - Name used to identify the resource.
   * @param ready - Pending readiness of the Redis connection.
   * @returns BaseQueue configured for the test.
   */
  function createQueue(
    name = "email",
    ready: Promise<void> = Promise.resolve(),
  ) {
    const isPaused = vi.fn(() => Promise.resolve(false));
    const queue = Object.assign(
      Object.create(BaseQueue.prototype) as BaseQueue,
      {
        name,
        isPaused,
      },
    );
    Object.defineProperty(queue, "waitUntilReady", {
      value: () => ready,
    });
    Object.defineProperty(queue, "getBackend", {
      value: () => ({ connection: { isClosing: false } }),
    });
    return { queue, isPaused };
  }

  /** @returns Health indicator with the queue manager stubbed. */
  function createIndicator() {
    const manager = { getQueues: vi.fn() };
    return new QueueHealthIndicator(manager as unknown as QueueManager);
  }

  it("reports read failures and recovery, and treats pausing as queue metadata", async () => {
    const { queue, isPaused } = createQueue();
    const indicator = createIndicator();
    isPaused.mockRejectedValueOnce(new Error("connection lost"));
    expect(await indicator.check("queue", queue)).toMatchObject({
      queue: { status: "down" },
    });
    isPaused.mockResolvedValue(true);
    expect(await indicator.check("queue", queue)).toMatchObject({
      queue: { status: "up", paused: true },
    });
  });

  it("does not enqueue reads when readiness fails or the queue is closing", async () => {
    const { queue, isPaused } = createQueue(
      "email",
      Promise.reject(new Error("Connection is not ready")),
    );
    const indicator = createIndicator();
    expect(await indicator.check("queue", queue)).toMatchObject({
      queue: { status: "down" },
    });
    queue.closing = Promise.resolve();
    expect(await indicator.check("queue", queue)).toMatchObject({
      queue: { status: "down", message: "Queue is closing" },
    });
    expect(isPaused).not.toHaveBeenCalled();
  });

  it("bounds readiness waits and does not perform a late read after timeout", async () => {
    let resolveReady!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const { queue, isPaused } = createQueue("email", pending);
    const indicator = createIndicator();
    try {
      expect(await indicator.check("queue", queue, 10)).toMatchObject({
        queue: { status: "down", message: "timeout of 10ms exceeded" },
      });
    } finally {
      resolveReady();
    }
    await pending;
    await Promise.resolve();
    expect(isPaused).not.toHaveBeenCalled();
  });

  it("bounds queue reads after the connection is ready", async () => {
    const { queue, isPaused } = createQueue();
    let resolvePause!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolvePause = resolve;
    });
    isPaused.mockReturnValue(pending);
    const indicator = createIndicator();
    try {
      expect(await indicator.check("queue", queue, 10)).toMatchObject({
        queue: { status: "down" },
      });
    } finally {
      resolvePause(false);
    }
  });

  it("shares a stalled read across probes while checking other queues independently", async () => {
    const { queue, isPaused } = createQueue();
    const { queue: other } = createQueue("upload");
    const indicator = createIndicator();
    let complete!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      complete = resolve;
    });
    isPaused.mockReturnValueOnce(pending);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        expect(await indicator.check("queue.email", queue, 10)).toMatchObject({
          "queue.email": { status: "down" },
        });
      }
      expect(isPaused).toHaveBeenCalledOnce();
      expect(await indicator.check("queue.upload", other)).toMatchObject({
        "queue.upload": { status: "up" },
      });
    } finally {
      complete(false);
      await pending;
    }
    expect(await indicator.check("queue.email", queue)).toMatchObject({
      "queue.email": { status: "up" },
    });
    expect(isPaused).toHaveBeenCalledTimes(2);
  });
});
