import {
  HealthCheckModule,
  HealthCheckRegistry,
} from "@nest-boot/health-check";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import {
  BaseQueue,
  Queue,
  QUEUE_MODULE_OPTIONS,
  QueueHealthIndicator,
  QueueModule,
  type QueueModuleOptions,
} from "../dist/index.js";
import { createPostgresFixture } from "./postgres.fixture.js";

describe("Queue health HTTP integration", () => {
  let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
    await fixture?.close();
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
    fixture = await createPostgresFixture();
    const connection = { ...fixture.connection, max: 1 };
    const rootModule =
      registration === "sync"
        ? QueueModule.forRoot({})
        : registration === "async"
          ? QueueModule.forRootAsync({ useFactory: () => ({}) })
          : QueueModule;
    @Queue({ name: "email", connection })
    class EmailQueue extends BaseQueue {}
    @Queue({ name: "upload", connection })
    class UploadQueue extends BaseQueue {}
    const queues = [EmailQueue, UploadQueue].map((queue) =>
      registration === "async"
        ? {
            provide: queue,
            inject: [QUEUE_MODULE_OPTIONS],
            useFactory: async (options: QueueModuleOptions) =>
              await Promise.resolve(new queue(options)),
          }
        : queue,
    );
    const module = await Test.createTestingModule({
      imports: [rootModule, ...(enabled ? [HealthCheckModule] : [])],
      providers: [
        ...queues,
        { provide: "QUEUE_ALIAS", useExisting: EmailQueue },
      ],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    app = module.createNestApplication();
    const email = app.get(EmailQueue);
    const upload = app.get(UploadQueue);
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
    const indicator = app.get(QueueHealthIndicator);
    // Occupy only this queue's single-connection pool while health reads queue up.
    const pending = email
      .getBackend()
      .connection.pool.query("select pg_sleep(1.3)");
    try {
      expect((await health()).status).toBe(503);
      expect(await indicator.check("queue.email", email, 10)).toMatchObject({
        "queue.email": { status: "down" },
      });
      expect(read).toHaveBeenCalledOnce();
    } finally {
      await pending;
    }
    await vi.waitFor(async () => {
      expect((await health()).status).toBe(200);
    });
  });
});
