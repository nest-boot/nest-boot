import type { FilterQuery } from "@mikro-orm/core";

import type { Job } from "./entities/job.entity.js";
import type { QueueOptions } from "./queue-options.interface.js";

/** Configuration options for the BullMQ module. */
export interface QueueModuleOptions extends QueueOptions {
  /** Enable job queries when DatabaseModule, Job metadata and GraphQL are available. Defaults to true. */
  graphql?: boolean;

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
