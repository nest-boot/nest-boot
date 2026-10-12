import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PostgresQueue } from "../dist/postgres.js";
import { createPostgresFixture } from "./postgres.fixture.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
let project: string;
let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
let reports: InstanceType<typeof PostgresQueue>;
let emails: InstanceType<typeof PostgresQueue>;
const children: ChildProcessWithoutNullStreams[] = [];

beforeEach(async () => {
  fixture = await createPostgresFixture("tasks");
  project = await mkdtemp(join(tmpdir(), "nest-boot-worker-"));
  await mkdir(join(project, "src"));
  await mkdir(join(project, "node_modules/@nest-boot"), { recursive: true });
  for (const name of ["command", "queue", "schedule"]) {
    await symlink(
      join(root, "packages", name),
      join(project, "node_modules/@nest-boot", name),
      "dir",
    );
  }
  await symlink(
    join(root, "packages/queue/node_modules/@nestjs"),
    join(project, "node_modules/@nestjs"),
    "dir",
  );
  await writeFile(
    join(project, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await writeFile(
    join(project, "src/cli.ts"),
    `
import { CommandFactory, CommandModule } from '@nest-boot/command';
import { BaseQueue, BaseProcessor, Queue, Processor, QueueModule } from '@nest-boot/queue';
import { Interval, ScheduleModule } from '@nest-boot/schedule';
import { Injectable, Module } from '@nestjs/common';
@Queue({ name: 'reports' }) class ReportsQueue extends BaseQueue {}
@Queue({ name: 'emails' }) class EmailsQueue extends BaseQueue {}
@Processor(ReportsQueue) class ReportsProcessor extends BaseProcessor {
  async process(job) {
    console.log('ACTIVE:' + job.id);
    await new Promise(resolve => setTimeout(resolve, job.data.delay ?? 0));
    console.log('DONE:' + job.id);
    return 'processed';
  }
}
@Processor(EmailsQueue) class EmailsProcessor extends ReportsProcessor {}
@Injectable() class Tasks {
  @Interval('100') async tick() { console.log('TICK'); }
}
@Module({
  imports: [CommandModule, QueueModule.forRoot({ connection: ${JSON.stringify(fixture.connection)}, graphql: false }), ScheduleModule],
  providers: [ReportsQueue, EmailsQueue, ReportsProcessor, EmailsProcessor, Tasks],
}) class AppModule {}
async function bootstrap() { await CommandFactory.run(AppModule); }
void bootstrap();
`,
  );
  reports = new PostgresQueue("reports", { connection: fixture.connection });
  emails = new PostgresQueue("emails", { connection: fixture.connection });
}, 20_000);

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await vi.waitFor(
        () => {
          expect(child.exitCode ?? child.signalCode).not.toBeNull();
        },
        { timeout: 10_000 },
      );
    }
  }
  await Promise.all([reports?.close(), emails?.close()]);
  await fixture?.close();
  if (project) await rm(project, { recursive: true, force: true });
}, 20_000);

/**
 * Starts the real CLI executable from an application directory.
 * @param args - Arguments passed to nb.
 * @returns The worker process and its captured output.
 */
function run(args: string[]) {
  const child = spawn(
    process.execPath,
    [join(root, "packages/command/dist/cli.js"), ...args],
    {
      cwd: project,
      env: { ...process.env, NODE_ENV: "development", NODE_OPTIONS: "" },
    },
  );
  children.push(child);
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  return { child, output: () => output };
}

/**
 * Waits for readiness or job output from a live worker process.
 * @param process - Process and captured output.
 * @param expected - Text that indicates the operation completed.
 */
async function waitForOutput(
  process: ReturnType<typeof run>,
  expected: string,
) {
  await vi.waitFor(
    () => {
      if (process.child.exitCode !== null || process.child.signalCode !== null)
        throw new Error(process.output());
      expect(process.output()).toContain(expected);
    },
    { timeout: 10_000 },
  );
}

it("keeps all jobs waiting and leaves schedules unregistered when executing ordinary commands", async () => {
  const job = await reports.add("report", {});
  const process = run(["--help"]);
  await vi.waitFor(
    () => {
      expect(process.child.exitCode).toBe(0);
    },
    {
      timeout: 10_000,
    },
  );
  expect(process.output()).toContain("queue:run");
  expect(await job.getState()).toBe("waiting");
  expect(
    (
      await fixture.pool.query(
        "select count(*)::int as count from tasks.scheduler",
      )
    ).rows[0].count,
  ).toBe(0);
});

it("runs only selected queues and drains the active job on SIGTERM", async () => {
  const waiting = await emails.add("email", {});
  const process = run([
    "queue:run",
    "--queue",
    "reports",
    "--queue",
    "reports",
  ]);
  await waitForOutput(process, "Queue workers running: reports.");
  const job = await reports.add("report", { delay: 500 });
  await waitForOutput(process, `ACTIVE:${String(job.id)}`);
  process.child.kill("SIGTERM");
  await vi.waitFor(
    () => {
      expect(process.child.exitCode).toBe(0);
    },
    {
      timeout: 10_000,
    },
  );
  expect(process.output()).toContain(`DONE:${String(job.id)}`);
  expect(await job.getState()).toBe("completed");
  expect(await waiting.getState()).toBe("waiting");
  expect(
    (
      await fixture.pool.query(
        "select count(*)::int as count from tasks.scheduler",
      )
    ).rows[0].count,
  ).toBe(0);
}, 20_000);

it("runs every registered queue including scheduled handlers and exits cleanly on SIGINT", async () => {
  const first = await reports.add("report", {});
  const second = await emails.add("email", {});
  const process = run(["queue:run"]);
  await waitForOutput(process, "Queue workers running:");
  await waitForOutput(process, "TICK");
  await vi.waitFor(async () => {
    expect(await first.getState()).toBe("completed");
    expect(await second.getState()).toBe("completed");
  });
  expect(
    (
      await fixture.pool.query(
        "select count(*)::int as count from tasks.scheduler",
      )
    ).rows[0].count,
  ).toBe(1);
  process.child.kill("SIGINT");
  await vi.waitFor(
    () => {
      expect(process.child.exitCode).toBe(0);
    },
    {
      timeout: 10_000,
    },
  );
}, 20_000);

it("reports an unknown queue and exits without consuming jobs", async () => {
  const job = await reports.add("report", {});
  const process = run(["queue:run", "--queue", "typo"]);
  await vi.waitFor(
    () => {
      expect(process.child.exitCode).toBe(1);
    },
    {
      timeout: 10_000,
    },
  );
  expect(process.output()).toContain('Unknown queue "typo"');
  expect(await job.getState()).toBe("waiting");
});
