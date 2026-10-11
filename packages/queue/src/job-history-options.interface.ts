import { type EntityData } from "@mikro-orm/core";
import type { Job as BullJob } from "bullmq";

import type { Job } from "./entities/job.entity.js";

/** Settings for opted-in queue job history. */
export interface JobHistoryOptions {
  /** Time-to-live (in milliseconds) after which inactive history records are deleted, based on their last update. */
  jobTTL?: number;

  /** Custom function to convert a BullMQ job into entity data for persistence. */
  convertJobToEntityData?: (
    job: BullJob,
  ) => EntityData<Job> | Promise<EntityData<Job>>;
}
