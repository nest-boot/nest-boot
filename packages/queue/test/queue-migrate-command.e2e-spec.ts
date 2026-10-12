import { Writable } from "node:stream";

import { CommandFactory, CommandModule } from "@nest-boot/command";
import { Module } from "@nestjs/common";
import { LATEST_SCHEMA_VERSION } from "bullmq";

import {
  BaseProcessor,
  BaseQueue,
  Processor,
  Queue,
  QueueEventsHost,
  QueueEventsListener,
  QueueModule,
} from "../dist/index.js";
import { createPostgresFixture } from "./postgres.fixture.js";

it("discovers queue:migrate, initializes a fresh custom schema and preserves jobs on repeated migrations", async () => {
  const fixture = await createPostgresFixture("tasks");
  const chunks: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  @Queue({ name: "reports" })
  class ReportQueue extends BaseQueue {}
  @Processor(ReportQueue)
  class ReportProcessor extends BaseProcessor {
    async process(): Promise<void> {
      await Promise.reject(new Error("CLI must not consume jobs"));
    }
    onApplicationBootstrap() {
      expect(() => this.worker).toThrow("Worker is not initialized");
    }
  }
  @QueueEventsListener(ReportQueue)
  class ReportEvents extends QueueEventsHost {
    onApplicationBootstrap() {
      expect(() => this.queueEvents).toThrow(
        "Queue events are not initialized",
      );
    }
  }
  @Module({
    providers: [ReportQueue, ReportProcessor, ReportEvents],
    imports: [
      CommandModule,
      QueueModule.forRoot({ connection: fixture.connection, graphql: false }),
    ],
  })
  class CliModule {}
  try {
    await fixture.pool.query("drop schema tasks cascade");
    expect(
      await CommandFactory.run(CliModule, {
        args: ["queue:migrate"],
        context: { stdout },
      }),
    ).toBe(0);
    const { rows } = await fixture.pool.query(
      "select max(version) as version from tasks.migration",
    );
    expect(rows[0].version).toBe(LATEST_SCHEMA_VERSION);
    const { rows: functions } = await fixture.pool.query(
      "select count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'tasks'",
    );
    expect(functions[0].count).toBeGreaterThan(40);
    await fixture.pool.query(
      "insert into tasks.meta (queue, field, value) values ('reports', 'test', 'preserved')",
    );
    expect(
      await CommandFactory.run(CliModule, {
        args: ["queue:migrate"],
        context: { stdout },
      }),
    ).toBe(0);
    expect(
      (
        await fixture.pool.query(
          "select value from tasks.meta where field = 'test'",
        )
      ).rows,
    ).toEqual([{ value: "preserved" }]);
    expect(
      await CommandFactory.run(CliModule, {
        args: ["queue:migrate", "--schema", "override_tasks"],
        context: { stdout },
      }),
    ).toBe(0);
    expect(
      (
        await fixture.pool.query(
          "select max(version) as version from override_tasks.migration",
        )
      ).rows[0].version,
    ).toBe(LATEST_SCHEMA_VERSION);
    expect(chunks.join("")).toContain(
      `version ${String(LATEST_SCHEMA_VERSION)}`,
    );
  } finally {
    await fixture.close();
  }
});
