import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { Queue as BullmqQueue } from "bullmq";

import { runCli } from "../cli.fixture.js";
import { createRedisFixture } from "../redis.fixture.js";

let fixture: Awaited<ReturnType<typeof createRedisFixture>>;
const children: ChildProcessWithoutNullStreams[] = [];

beforeEach(async () => {
  fixture = await createRedisFixture();
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
  await fixture?.close();
}, 20_000);

/**
 * Starts the real CLI executable from the schedule fixture application.
 * @param args - Arguments passed to nb.
 * @returns The worker process and its captured output.
 */
function run(args: string[]) {
  const running = runCli(args, fixture);
  children.push(running.child);
  return running;
}

/**
 * Waits for readiness or scheduled handler output from a live worker process.
 * @param process - Process and captured output.
 * @param expected - Text that indicates the operation completed.
 */
async function waitForOutput(
  process: ReturnType<typeof run>,
  expected: string,
) {
  await vi.waitFor(
    () => {
      if (
        process.child.exitCode !== null ||
        process.child.signalCode !== null
      ) {
        throw new Error(process.output());
      }
      expect(process.output()).toContain(expected);
    },
    { timeout: 10_000 },
  );
}

it.each([["--help"], ["queue"], ["queue", "--help"]].map((args) => [args]))(
  "registers schedules without executing handlers when listing commands with %j",
  async (args) => {
    const process = run(args);
    await vi.waitFor(
      () => {
        expect(process.child.exitCode).toBe(0);
      },
      { timeout: 10_000 },
    );
    const schedules = new BullmqQueue("schedule", fixture.options);
    try {
      expect(await schedules.getJobSchedulers()).toEqual([
        expect.objectContaining({
          key: "TasksService.tick",
          name: "run",
          template: expect.objectContaining({
            data: { name: "TasksService.tick" },
          }),
        }),
      ]);
    } finally {
      await schedules.close();
    }
    expect(process.output()).not.toContain("TICK");
  },
);

it("registers schedules without running them when starting another queue", async () => {
  const process = run(["queue", "start", "--queue", "other"]);
  await waitForOutput(process, "Queue workers running: other.");
  process.child.kill("SIGTERM");
  await vi.waitFor(
    () => {
      expect(process.child.exitCode).toBe(0);
    },
    { timeout: 10_000 },
  );
  const schedules = new BullmqQueue("schedule", fixture.options);
  try {
    expect(await schedules.getJobSchedulers()).toHaveLength(1);
  } finally {
    await schedules.close();
  }
  expect(process.output()).not.toContain("TICK");
}, 20_000);

it("runs scheduled handlers when starting all queues and exits cleanly on SIGINT", async () => {
  const process = run(["queue", "start"]);
  await waitForOutput(process, "Queue workers running:");
  await waitForOutput(process, "TICK");
  const schedules = new BullmqQueue("schedule", fixture.options);
  try {
    expect(await schedules.getJobSchedulers()).toHaveLength(1);
  } finally {
    await schedules.close();
  }
  process.child.kill("SIGINT");
  await vi.waitFor(
    () => {
      expect(process.child.exitCode).toBe(0);
    },
    { timeout: 10_000 },
  );
}, 20_000);

it("registers schedules without invoking handlers when running an ordinary command", async () => {
  const running = run(["ping"]);
  expect(await running.exited, running.output()).toBe(0);
  expect(running.output()).toContain("PONG");
  expect(running.output()).not.toContain("TICK");
  const schedules = new BullmqQueue("schedule", fixture.options);
  try {
    expect(await schedules.getJobSchedulers()).toHaveLength(1);
  } finally {
    await schedules.close();
  }
}, 20_000);
