import type { QueueOptions } from "@nest-boot/queue";
import { Queue } from "@nest-boot/queue";
import { BaseQueue } from "@nest-boot/queue";
import { Optional } from "@nestjs/common";
import type { JobProgress } from "bullmq";
import { z } from "zod";

import { JobStatus } from "../enums/job-status.enum.js";

/** Built-in Redis queue for synchronizing and cleaning up Job records. */
@Queue()
export class JobQueue extends BaseQueue {
  readonly jobSchemas = {
    cleanup: { data: z.object({}) },
    sync: {
      data: z.object({
        eventId: z.string().regex(/^\d+-\d+$/),
        data: z.object({
          queue: z.string(),
          jobId: z.string(),
          name: z.string().optional(),
          data: z.record(z.string(), z.unknown()).optional(),
          status: z.enum(JobStatus).optional(),
          progress: z
            .custom<JobProgress>(
              (value) =>
                typeof value === "number" ||
                typeof value === "string" ||
                typeof value === "boolean" ||
                (typeof value === "object" && value !== null),
            )
            .nullish(),
          returnValue: z.unknown().optional(),
          failedReason: z.string().nullish(),
          createdAt: z.number().int().nonnegative().optional(),
          startedAt: z.number().int().nonnegative().nullish(),
          finishedAt: z.number().int().nonnegative().nullish(),
        }),
      }),
    },
  };

  constructor(@Optional() options: QueueOptions = {}) {
    super({
      ...options,
      defaultJobOptions: {
        attempts: 20,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 1000,
        ...options.defaultJobOptions,
      },
    });
  }
}
