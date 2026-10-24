import type { Job } from "@nest-boot/queue";
import { z } from "zod";

import { JobStatus } from "../enums/job-status.enum.js";
import { JobQueue } from "./job.queue.js";

vi.mock("bullmq", async (original) => {
  const actual = await original<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  return {
    ...actual,
    Queue: class extends EventEmitter {
      close = vi.fn().mockResolvedValue(undefined);
      constructor(
        readonly name: string,
        readonly opts: object,
      ) {
        super();
      }
    },
  };
});

it.each([
  { status: 123 },
  { status: "invalid" },
  { createdAt: { invalid: true } },
  { createdAt: -1 },
  { startedAt: "2026-01-01" },
  { finishedAt: 1.5 },
  { name: 123 },
  { failedReason: 123 },
  { data: [] },
])("rejects invalid history fields before enqueueing: %j", async (fields) => {
  const queue = new JobQueue();
  try {
    await expect(
      queue.validateJobData("sync", {
        eventId: "1000-1",
        data: { queue: "email", jobId: "1", ...fields },
      }),
    ).rejects.toBeInstanceOf(z.ZodError);
  } finally {
    await queue.close();
  }
});

it("validates complete and partial snapshots with inferred field types", async () => {
  const queue = new JobQueue();
  try {
    await queue.validateJobData("sync", {
      eventId: "1000-1",
      data: {
        queue: "email",
        jobId: "1",
        status: JobStatus.COMPLETED,
        returnValue: { sent: true },
        finishedAt: 1000,
      },
    });
    await queue.validateJobData("sync", {
      eventId: "1000-2",
      data: {
        queue: "email",
        jobId: "1",
        name: "send",
        data: { userId: "alice" },
        status: JobStatus.ACTIVE,
        progress: { done: 1 },
        createdAt: 1000,
        startedAt: null,
        finishedAt: null,
        failedReason: null,
      },
    });
    type Snapshot = Job<JobQueue, "sync">["data"]["data"];
    expectTypeOf<Snapshot["status"]>().toEqualTypeOf<JobStatus | undefined>();
    expectTypeOf<Snapshot["createdAt"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Snapshot["finishedAt"]>().toEqualTypeOf<
      number | null | undefined
    >();
  } finally {
    await queue.close();
  }
});
