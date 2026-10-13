import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { PostgresQueue } from "../dist/postgres.js";
import { runCli } from "./cli.fixture.js";
import { createPostgresFixture } from "./postgres.fixture.js";

let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
let reports: InstanceType<typeof PostgresQueue>;
let emails: InstanceType<typeof PostgresQueue>;
const children: ChildProcessWithoutNullStreams[] = [];

beforeEach(async () => {
  fixture = await createPostgresFixture("tasks");
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
}, 20_000);

/**
 * Starts the real CLI executable from an application directory.
 * @param args - Arguments passed to nb.
 * @returns The worker process and its captured output.
 */
function run(args: string[]) {
  const running = runCli(args, fixture.connection);
  children.push(running.child);
  return running;
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

it("interrupts a pending startup hook without starting consumers", async () => {
  const job = await reports.add("report", {});
  const running = runCli(
    ["queue:run", "--queue", "reports"],
    fixture.connection,
    {
      QUEUE_TEST_STARTUP: "blocked",
    },
  );
  children.push(running.child);
  await waitForOutput(running, "STARTING:reports");
  running.child.kill("SIGTERM");
  expect(await running.exited, running.output()).toBe(0);
  expect(await job.getState()).toBe("waiting");
}, 20_000);
