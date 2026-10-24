import {
  type EntityData,
  EntityManager,
  type FilterQuery,
} from "@mikro-orm/core";
import { BaseProcessor, type Job, Processor } from "@nest-boot/queue";
import { pick } from "lodash-es";

import { Job as JobEntity } from "../entities/job.entity.js";
import { JobStatus } from "../enums/job-status.enum.js";
import { JobQueue } from "../queues/job.queue.js";

/** Synchronizes Job records and removes expired records. */
@Processor(JobQueue)
export class JobProcessor extends BaseProcessor {
  constructor(private readonly em: EntityManager) {
    super();
  }

  /**
   * Deletes records inactive for 30 days, falling back to their creation time.
   * @param _job - Scheduled cleanup task.
   */
  async processCleanup(_job: Job<JobQueue, "cleanup">) {
    const em = this.em.fork({ disableContextResolution: true });
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const where: FilterQuery<JobEntity> = {
      $or: [
        { lastEventMs: { $gt: 0n, $lt: BigInt(cutoff) } },
        { lastEventMs: 0n, createdAt: { $lt: new Date(cutoff) } },
      ],
    };
    let lastId: string | undefined;
    while (true) {
      const rows = await em.find(
        JobEntity,
        { $and: [where, ...(lastId ? [{ id: { $gt: lastId } }] : [])] },
        {
          fields: ["id"],
          orderBy: { id: "asc" },
          limit: 1000,
          disableIdentityMap: true,
        },
      );
      if (!rows.length) {
        return;
      }
      lastId = rows[rows.length - 1].id;
      // Recheck eligibility so a concurrent event cannot delete a refreshed job.
      await em.nativeDelete(JobEntity, {
        $and: [where, { id: { $in: rows.map(({ id }) => id) } }],
      });
    }
  }

  /**
   * Inserts new history and applies only strictly newer events.
   * @param job - Deduplicated synchronization job.
   */
  async processSync(job: Job<JobQueue, "sync">) {
    const { eventId, data: snapshot } = job.data;
    const [ms, seq] = eventId.split("-");
    const data: EntityData<JobEntity> = {
      ...pick(snapshot, [
        "queue",
        "jobId",
        "name",
        "data",
        "status",
        "progress",
        "returnValue",
        "failedReason",
      ]),
      lastEventMs: BigInt(ms),
      lastEventSeq: BigInt(seq),
    };
    for (const field of ["createdAt", "startedAt", "finishedAt"] as const) {
      const timestamp = snapshot[field];
      if (timestamp !== undefined) {
        data[field] = timestamp === null ? null : new Date(timestamp);
      }
    }
    const em = this.em.fork({ disableContextResolution: true });
    // A concurrent insert must never overwrite an already newer version.
    await em.upsert(
      JobEntity,
      {
        name: "",
        data: {},
        status: JobStatus.UNKNOWN,
        createdAt: new Date(Number(ms)),
        ...data,
      },
      {
        onConflictFields: ["queue", "jobId"],
        onConflictAction: "ignore",
      },
    );
    await em.nativeUpdate(
      JobEntity,
      {
        queue: data.queue,
        jobId: data.jobId,
        $or: [
          { lastEventMs: { $lt: data.lastEventMs } },
          {
            lastEventMs: data.lastEventMs,
            lastEventSeq: { $lt: data.lastEventSeq },
          },
        ],
      },
      data,
    );
  }
}
