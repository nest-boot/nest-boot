import { once } from "node:events";

import {
  HealthCheckModule,
  HealthCheckRegistry,
} from "@nest-boot/health-check";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Redis } from "ioredis";

import { RedisHealthIndicator, RedisModule } from "../dist/index.js";

describe("Redis health HTTP integration", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  async function createApp(
    enabled = true,
    registration: "default" | "sync" | "async" = "default",
  ) {
    const redisModule =
      registration === "sync"
        ? RedisModule.register({ db: 0 })
        : registration === "async"
          ? RedisModule.registerAsync({ useFactory: () => ({ db: 0 }) })
          : RedisModule;
    const module = await Test.createTestingModule({
      imports: [redisModule, ...(enabled ? [HealthCheckModule] : [])],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    app = module.createNestApplication();
    const client = app.get(Redis);
    await client.ping();
    const ping = vi.spyOn(client, "ping");
    await app.listen(0, "127.0.0.1");
    return { client, ping };
  }

  async function health() {
    const response = await fetch(`${await app.getUrl()}/api/health`);
    const body: unknown = await response.json();
    return { status: response.status, body };
  }

  it.each([false, true])(
    "registers only when health checks are enabled: %s",
    async (enabled) => {
      const { ping } = await createApp(enabled);
      expect(ping).not.toHaveBeenCalled();
      expect(app.get(RedisHealthIndicator)).toBeInstanceOf(
        RedisHealthIndicator,
      );
      if (enabled) {
        expect(app.get(HealthCheckRegistry).healthIndicators).toHaveLength(1);
        expect(await health()).toMatchObject({
          status: 200,
          body: { details: { redis: { status: "up" } } },
        });
        expect(ping).toHaveBeenCalledOnce();
      } else {
        expect((await health()).status).toBe(404);
        expect(ping).not.toHaveBeenCalled();
      }
    },
  );

  it("returns 503 for a disconnected client and recovers on the same connection", async () => {
    const { client, ping } = await createApp();
    const disconnected = once(client, "end");
    client.disconnect();
    await disconnected;
    try {
      expect(await health()).toMatchObject({
        status: 503,
        body: { error: { redis: { status: "down" } } },
      });
      expect(ping).not.toHaveBeenCalled();
    } finally {
      await client.connect();
    }
    expect((await health()).status).toBe(200);
  });

  it.each(["sync", "async"] as const)(
    "uses the configured Redis client with %s registration",
    async (registration) => {
      await createApp(true, registration);
      expect(app.get(HealthCheckRegistry).healthIndicators).toHaveLength(1);
      expect((await health()).status).toBe(200);
    },
  );

  it("bounds stalled Redis probes, shares their command, and reports recovery", async () => {
    const { client, ping } = await createApp();
    const indicator = app.get(RedisHealthIndicator);
    // Stall only this connection so other suites can share the Redis server.
    client.stream.pause();
    try {
      expect(await health()).toMatchObject({
        status: 503,
        body: { error: { redis: { status: "down" } } },
      });
      expect(await indicator.pingCheck("redis", 10)).toMatchObject({
        redis: { status: "down" },
      });
      expect(ping).toHaveBeenCalledOnce();
    } finally {
      client.stream.resume();
    }
    await client.ping();
    expect((await health()).status).toBe(200);
  });
});
