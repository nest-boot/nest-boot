import { type EntityData } from "@mikro-orm/core";
import type { Job as BullJob } from "bullmq";

import type { Job } from "./entities/job.entity.js";

/** Settings for persisted queue jobs. */
export interface JobOptions {
  /** Time-to-live (in milliseconds) after which inactive job records are deleted, based on their last update. */
  jobTTL?: number;

  /** Custom function to convert a BullMQ job into entity data for persistence. */
  convertJobToEntityData?: (
    job: BullJob,
  ) => EntityData<Job> | Promise<EntityData<Job>>;
}
