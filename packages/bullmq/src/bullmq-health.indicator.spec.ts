import { HealthCheckRegistry } from "@nest-boot/health-check";
import type { DiscoveryService } from "@nestjs/core";
import { Queue } from "bullmq";

import { BullMQHealthIndicator } from "./bullmq-health.indicator.js";

describe("BullMQHealthIndicator", () => {
  function createQueue(
    name = "email",
    client = Promise.resolve({ status: "ready" }),
  ) {
    const queue = Object.assign(Object.create(Queue.prototype) as Queue, {
      name,
      qualifiedName: `bull:${name}`,
      isPaused: vi.fn(() => Promise.resolve(false)),
    });
    Object.defineProperty(queue, "client", { value: client });
    return queue;
  }

  function setup(instances: unknown[] = [], registry?: HealthCheckRegistry) {
    const discovery = {
      getProviders: vi.fn(() => instances.map((instance) => ({ instance }))),
    };
    return {
      discovery,
      indicator: new BullMQHealthIndicator(
        discovery as unknown as DiscoveryService,
        registry,
      ),
    };
  }

  it("discovers queues and deduplicates aliases without running probes at startup", async () => {
    const email = createQueue();
    const upload = createQueue("upload");
    const registry = new HealthCheckRegistry();
    const { indicator } = setup([email, email, upload, {}], registry);
    indicator.onApplicationBootstrap();
    expect(registry.healthIndicators).toHaveLength(2);
    expect(email.isPaused).not.toHaveBeenCalled();
    const results = await Promise.all(
      registry.healthIndicators.map((check) =>
        Promise.resolve(typeof check === "function" ? check() : check),
      ),
    );
    expect(results[0]).toMatchObject({
      "queue.email": { status: "up", paused: false },
    });
    expect(results[1]).toMatchObject({
      "queue.upload": { status: "up" },
    });
  });

  it("does not discover or check queues without HealthCheckModule", () => {
    const { indicator, discovery } = setup([createQueue()]);
    indicator.onApplicationBootstrap();
    expect(discovery.getProviders).not.toHaveBeenCalled();
  });

  it("reports read failures and recovery, and treats pausing as queue metadata", async () => {
    const queue = createQueue();
    const { indicator } = setup();
    vi.mocked(queue.isPaused).mockRejectedValueOnce(
      new Error("connection lost"),
    );
    expect(await indicator.check("queue", queue)).toMatchObject({
      queue: { status: "down" },
    });
    vi.mocked(queue.isPaused).mockResolvedValue(true);
    expect(await indicator.check("queue", queue)).toMatchObject({
      queue: { status: "up", paused: true },
    });
  });

  it("does not enqueue reads for reconnecting or closing queues", async () => {
    const queue = createQueue(
      "email",
      Promise.resolve({ status: "reconnecting" }),
    );
    const { indicator } = setup();
    expect(await indicator.check("queue", queue)).toMatchObject({
      queue: { status: "down" },
    });
    queue.closing = Promise.resolve();
    expect(await indicator.check("queue", queue)).toMatchObject({
      queue: { status: "down", message: "Queue is closing" },
    });
    expect(queue.isPaused).not.toHaveBeenCalled();
  });

  it("bounds readiness waits and does not perform a late read after timeout", async () => {
    let resolveClient!: (value: { status: string }) => void;
    const pending = new Promise<{ status: string }>((resolve) => {
      resolveClient = resolve;
    });
    const queue = createQueue("email", pending);
    const { indicator } = setup();
    try {
      expect(await indicator.check("queue", queue, 10)).toMatchObject({
        queue: { status: "down", message: "timeout of 10ms exceeded" },
      });
    } finally {
      resolveClient({ status: "ready" });
    }
    await pending;
    await Promise.resolve();
    expect(queue.isPaused).not.toHaveBeenCalled();
  });

  it("bounds queue reads after the connection is ready", async () => {
    const queue = createQueue();
    let resolvePause!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolvePause = resolve;
    });
    vi.mocked(queue.isPaused).mockReturnValue(pending);
    const { indicator } = setup();
    try {
      expect(await indicator.check("queue", queue, 10)).toMatchObject({
        queue: { status: "down" },
      });
    } finally {
      resolvePause(false);
    }
  });
});
