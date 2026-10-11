import type { FilterQuery } from "@mikro-orm/core";
import { ConnectionOptions, type QueueOptions } from "bullmq";

import type { Job } from "./entities/job.entity.js";
import type { JobPersistenceOptions } from "./job-persistence-options.interface.js";

/** Configuration options for the BullMQ module. */
export interface QueueModuleOptions extends Omit<QueueOptions, "connection"> {
  /** Redis connection options for BullMQ queues and workers. */
  connection?: ConnectionOptions;

  /** Enable job queries when job persistence and GraphQL are available. Defaults to true. */
  graphql?: boolean;

  /** Global persistence switch and retention; queues opt in with persist: true. */
  persistence?: JobPersistenceOptions;

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
