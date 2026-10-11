import type { QueueOptions } from "./queue-options.interface.js";

/**
 * Configuration options for the BullMQ module.
 * @template ReadFilter - Query type supplied by the optional database integration.
 */
export interface QueueModuleOptions<ReadFilter = object> extends QueueOptions {
  /** Enable job queries when DatabaseModule, Job metadata and GraphQL are available. Defaults to true. */
  graphql?: boolean;

  /**
   * Authorizes each job read and returns its database scope using trusted request context.
   * Missing callbacks, null and undefined deny access. Return {} only to grant all jobs.
   */
  getJobReadFilter?: () =>
    | ReadFilter
    | null
    | undefined
    | Promise<ReadFilter | null | undefined>;
}
