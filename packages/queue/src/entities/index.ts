import { Job } from "./job.entity.js";
import { JobDependency } from "./job-dependency.entity.js";
import { JobLog } from "./job-log.entity.js";
import { QueueDedup } from "./queue-dedup.entity.js";
import { QueueDedupNext } from "./queue-dedup-next.entity.js";
import { QueueEvent } from "./queue-event.entity.js";
import { QueueMeta } from "./queue-meta.entity.js";
import { QueueMetrics } from "./queue-metrics.entity.js";
import { QueueMigration } from "./queue-migration.entity.js";
import { QueueRateLimit } from "./queue-rate-limit.entity.js";
import { QueueScheduler } from "./queue-scheduler.entity.js";
export * from "./job.entity.js";
export * from "./job-dependency.entity.js";
export * from "./job-log.entity.js";
export * from "./queue-dedup.entity.js";
export * from "./queue-dedup-next.entity.js";
export * from "./queue-event.entity.js";
export * from "./queue-meta.entity.js";
export * from "./queue-metrics.entity.js";
export * from "./queue-migration.entity.js";
export * from "./queue-rate-limit.entity.js";
export * from "./queue-scheduler.entity.js";

/** Native BullMQ entities for MikroORM runtime and migration discovery. */
export const entities = [
  Job,
  QueueMeta,
  QueueMigration,
  JobLog,
  JobDependency,
  QueueEvent,
  QueueMetrics,
  QueueRateLimit,
  QueueDedup,
  QueueScheduler,
  QueueDedupNext,
];
