import { randomUUID } from "node:crypto";

import {
  HealthCheckModule,
  HealthCheckRegistry,
} from "@nest-boot/health-check";
import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Queue } from "bullmq";

import { QueueHealthIndicator, QueueModule } from "../dist/index.js";

describe("Queue health HTTP integration", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  /**
   * Returns initialized test application and its exposed dependencies.
   * @param enabled - Whether this feature is enabled.
   * @param registration - Module registration variant exercised by the test.
   * @returns Initialized test application and its exposed dependencies.
   */
  async function createApp(
    enabled = true,
    registration: "default" | "sync" | "async" = "default",
  ) {
    const prefix = `health-e2e-${randomUUID()}`;
    const rootModule =
      registration === "sync"
        ? QueueModule.forRoot({})
        : registration === "async"
          ? QueueModule.forRootAsync({ useFactory: () => ({}) })
          : QueueModule;
    const queues =
      registration === "async"
        ? QueueModule.registerQueueAsync(
            { name: "email", useFactory: () => ({ prefix }) },
            { name: "upload", useFactory: () => ({ prefix }) },
          )
        : QueueModule.registerQueue(
            { name: "email", prefix },
            { name: "upload", prefix },
          );
    const module = await Test.createTestingModule({
      imports: [rootModule, queues, ...(enabled ? [HealthCheckModule] : [])],
      providers: [
        { provide: "QUEUE_ALIAS", useExisting: getQueueToken("email") },
      ],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    app = module.createNestApplication();
    const email = app.get<Queue>(getQueueToken("email"));
    const upload = app.get<Queue>(getQueueToken("upload"));
    await Promise.all([email.waitUntilReady(), upload.waitUntilReady()]);
    const read = vi.spyOn(email, "isPaused");
    await app.listen(0, "127.0.0.1");
    return { email, upload, read };
  }

  /**
   * Returns hTTP status and body returned by the health endpoint.
   * @returns HTTP status and body returned by the health endpoint.
   */
  async function health() {
    const response = await fetch(`${await app.getUrl()}/api/health`);
    const body: unknown = await response.json();
    return { status: response.status, body };
  }

  it.each([false, true])(
    "discovers and deduplicates queue providers only when enabled: %s",
    async (enabled) => {
      const { read } = await createApp(enabled);
      expect(read).not.toHaveBeenCalled();
      expect(app.get(QueueHealthIndicator)).toBeInstanceOf(
        QueueHealthIndicator,
      );
      if (enabled) {
        expect(app.get(HealthCheckRegistry).healthIndicators).toHaveLength(2);
        expect(await health()).toMatchObject({
          status: 200,
          body: {
            details: {
              "queue.email": { status: "up", paused: false },
              "queue.upload": { status: "up" },
            },
          },
        });
        expect(read).toHaveBeenCalledOnce();
      } else {
        expect((await health()).status).toBe(404);
        expect(read).not.toHaveBeenCalled();
      }
    },
  );

  it("reports pause and resume without marking a queue unhealthy or creating jobs", async () => {
    const { email, upload } = await createApp();
    await email.pause();
    expect(await health()).toMatchObject({
      status: 200,
      body: {
        details: {
          "queue.email": { status: "up", paused: true },
          "queue.upload": { status: "up", paused: false },
        },
      },
    });
    await email.resume();
    expect(await health()).toMatchObject({
      status: 200,
      body: { details: { "queue.email": { paused: false } } },
    });
    expect(await email.getJobCountByTypes()).toBe(0);
    expect(await upload.getJobCountByTypes()).toBe(0);
  });

  it("returns 503 for a closed queue while retaining healthy queue results", async () => {
    const { email } = await createApp();
    await email.close();
    expect(await health()).toMatchObject({
      status: 503,
      body: {
        error: { "queue.email": { status: "down" } },
        info: { "queue.upload": { status: "up" } },
      },
    });
  });

  it.each(["sync", "async"] as const)(
    "discovers queues with %s module configuration",
    async (registration) => {
      await createApp(true, registration);
      expect(app.get(HealthCheckRegistry).healthIndicators).toHaveLength(2);
      expect((await health()).status).toBe(200);
    },
  );

  it("bounds stalled reads, shares each pending command, and recovers", async () => {
    const { email, read } = await createApp();
    const client = await email.client;
    const indicator = app.get(QueueHealthIndicator);
    // Stall only this connection so other queues and suites remain responsive.
    client.stream.pause();
    try {
      expect((await health()).status).toBe(503);
      expect(await indicator.check("queue.email", email, 10)).toMatchObject({
        "queue.email": { status: "down" },
      });
      expect(read).toHaveBeenCalledOnce();
    } finally {
      client.stream.resume();
    }
    await client.ping();
    expect((await health()).status).toBe(200);
  });
});
