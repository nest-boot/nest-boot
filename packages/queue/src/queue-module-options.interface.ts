import type { FilterQuery } from "@mikro-orm/core";
import { ConnectionOptions, type QueueOptions } from "bullmq";

import type { Job } from "./entities/job.entity.js";
import type { JobOptions } from "./job-options.interface.js";

/** Configuration options for the BullMQ module. */
export interface QueueModuleOptions extends Omit<QueueOptions, "connection"> {
  /** Redis connection options for BullMQ queues and workers. */
  connection?: ConnectionOptions;

  /** Enable job queries when job persistence and GraphQL are available. Defaults to true. */
  graphql?: boolean;

  /** Settings used when DatabaseModule is registered. */
  job?: JobOptions;

  /**
   * Authorizes each job read and returns its database scope using trusted request context.
   * Missing callbacks, null and undefined deny access. Return {} only to grant all jobs.
   */
  getJobReadFilter?: () =>
    | FilterQuery<Job>
    | null
    | undefined
    | Promise<FilterQuery<Job> | null | undefined>;
}
