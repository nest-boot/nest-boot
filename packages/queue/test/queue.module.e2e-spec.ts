import { MikroORM } from "@mikro-orm/postgresql";
import { JobService, QueueRegistrar } from "@nest-boot/queue";
import { RequestContext } from "@nest-boot/request-context";
import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { ScheduleRegistry } from "../../schedule/dist/index.js";
import { ScheduleProcessor } from "../../schedule/dist/schedule.processor.js";
import { createPostgresFixture } from "./postgres.fixture.js";
import { AppModule } from "./src/app.module.js";
import { EmailsQueue } from "./src/app/worker/emails.queue.js";
import { ReportsProcessor } from "./src/app/worker/reports.processor.js";
import { ReportsQueue } from "./src/app/worker/reports.queue.js";
import { DatabaseAppModule } from "./src/database-app.module.js";

describe("QueueModule application integration", () => {
  let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
  let app: INestApplicationContext | undefined;

  beforeEach(async () => {
    fixture = await createPostgresFixture();
    vi.stubEnv("QUEUE_DATABASE_URL", fixture.connection.connectionString);
    vi.stubEnv("QUEUE_TEST_SCHEMA", fixture.connection.schema);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    await fixture?.close();
    vi.unstubAllEnvs();
  });

  it("enqueues jobs without DatabaseModule or GraphQL and keeps consumers idle", async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await app.init();
    expect(app.get(JobService)).toBeNull();
    const job = await app.get(ReportsQueue).add("report", {});
    expect(await job.getState()).toBe("waiting");
    expect(() => app?.get(ReportsProcessor).worker).toThrow("not initialized");
  });

  it("activates native database reads without GraphQL and hides internal queues", async () => {
    app = await Test.createTestingModule({
      imports: [DatabaseAppModule],
    }).compile();
    await app.get(MikroORM).schema.update();
    await app.init();
    const visible = await app
      .get(ReportsQueue)
      .add("report", { userId: "alice" });
    const hidden = await app.get(EmailsQueue).add("email", {});
    const service = app.get(JobService);
    expect(service).toBeInstanceOf(JobService);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      expect(
        await service.getJob(`reports:${String(visible.id)}`),
      ).toMatchObject({
        queue: "reports",
        name: "report",
      });
      expect(await service.getJob(`emails:${String(hidden.id)}`)).toBeNull();
    });
  }, 30_000);

  it("notifies the foreground command when the schedule worker fails to start its loop", async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await app.init();
    const failure = new Error("schedule stalled check failed");
    const schedules = app.get(ScheduleRegistry);
    const processor = app.get(ScheduleProcessor);
    const register = schedules.register.bind(schedules);
    vi.spyOn(schedules, "register").mockImplementation(async () => {
      await register();
      vi.spyOn(processor.worker, "startStalledCheckTimer").mockRejectedValue(
        failure,
      );
    });
    const registrar = app.get(QueueRegistrar);
    const stopped = expect(registrar.waitForStop()).rejects.toBe(failure);
    await registrar.start(["schedule"]);
    await stopped;
  }, 30_000);

  it("keeps the schedule worker idle when autorun is disabled", async () => {
    vi.stubEnv("QUEUE_TEST_SCHEDULE_AUTORUN", "false");
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await app.init();
    await app.get(QueueRegistrar).start(["schedule"]);
    expect(app.get(ScheduleProcessor).worker.isRunning()).toBe(false);
    const { rows } = await fixture.pool.query(
      `select count(*)::int as count from "${fixture.connection.schema}".scheduler`,
    );
    expect(rows[0].count).toBe(1);
  }, 30_000);
});
