import { HealthCheckRegistry } from "@nest-boot/health-check";
import type { Redis } from "ioredis";

import { RedisHealthIndicator } from "./redis-health.indicator.js";

describe("RedisHealthIndicator", () => {
  /**
   * Returns test setup and its mocked dependencies.
   * @param registry - Registry that owns the configured entries.
   * @returns Test setup and its mocked dependencies.
   */
  function setup(registry?: HealthCheckRegistry) {
    const client = {
      status: "ready",
      ping: vi.fn(() => Promise.resolve("PONG")),
    };
    const indicator = new RedisHealthIndicator(
      client as unknown as Redis,
      registry,
    );
    return { client, indicator };
  }

  it("registers a deferred check only when a registry is available", async () => {
    const registry = new HealthCheckRegistry();
    const { client, indicator } = setup(registry);
    indicator.onModuleInit();
    expect(client.ping).not.toHaveBeenCalled();
    expect(registry.healthIndicators).toHaveLength(1);
    const results = await Promise.all(
      registry.healthIndicators.map((check) =>
        Promise.resolve(typeof check === "function" ? check() : check),
      ),
    );
    expect(results[0]).toMatchObject({
      redis: { status: "up" },
    });
    expect(client.ping).toHaveBeenCalledOnce();

    const standalone = setup();
    standalone.indicator.onModuleInit();
    expect(standalone.client.ping).not.toHaveBeenCalled();
  });

  it("reports failure and recovery using the same existing connection", async () => {
    const { client, indicator } = setup();
    client.ping.mockRejectedValueOnce(new Error("connection lost"));
    expect(await indicator.pingCheck("cache")).toMatchObject({
      cache: { status: "down" },
    });
    expect(await indicator.pingCheck("cache")).toMatchObject({
      cache: { status: "up" },
    });
    expect(client.ping).toHaveBeenCalledTimes(2);
  });

  it("does not enqueue commands while the client is reconnecting", async () => {
    const { client, indicator } = setup();
    client.status = "reconnecting";
    expect(await indicator.pingCheck()).toMatchObject({
      redis: { status: "down" },
    });
    expect(client.ping).not.toHaveBeenCalled();
  });

  it("rejects unexpected ping replies", async () => {
    const { client, indicator } = setup();
    client.ping.mockResolvedValue("unexpected");
    expect(await indicator.pingCheck()).toMatchObject({
      redis: { status: "down" },
    });
  });

  it("bounds an unresponsive ping without closing the shared connection", async () => {
    const { client, indicator } = setup();
    let resolvePing!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      resolvePing = resolve;
    });
    client.ping.mockReturnValueOnce(pending);
    try {
      expect(await indicator.pingCheck("redis", 10)).toMatchObject({
        redis: { status: "down", message: "timeout of 10ms exceeded" },
      });
    } finally {
      resolvePing("PONG");
    }
    expect(await indicator.pingCheck()).toMatchObject({
      redis: { status: "up" },
    });
  });

  it("shares a stalled command across timed-out probes and starts fresh after it settles", async () => {
    const { client, indicator } = setup();
    let complete!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      complete = resolve;
    });
    client.ping.mockReturnValueOnce(pending);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        expect(await indicator.pingCheck("redis", 10)).toMatchObject({
          redis: { status: "down" },
        });
      }
      expect(client.ping).toHaveBeenCalledOnce();
    } finally {
      complete("PONG");
      await pending;
    }
    expect(await indicator.pingCheck()).toMatchObject({
      redis: { status: "up" },
    });
    expect(client.ping).toHaveBeenCalledTimes(2);
  });
});
