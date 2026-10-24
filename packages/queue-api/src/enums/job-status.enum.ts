import { registerEnumType } from "@nest-boot/graphql";

/** BullMQ job state values, shared by the entity and GraphQL API. */
export enum JobStatus {
  /** Job is waiting in the Redis prioritized set. */
  PRIORITIZED = "prioritized",
  /** No source job state could be recovered from Redis. */
  UNKNOWN = "unknown",
  /** Job is waiting to be processed, without a priority. */
  WAITING = "waiting",
  /** Job is actively being processed. */
  ACTIVE = "active",
  /** Job has completed successfully. */
  COMPLETED = "completed",
  /** Job has failed; it may be retried according to its retry policy. */
  FAILED = "failed",
  /** Job is delayed and will be processed later. */
  DELAYED = "delayed",
  /** Job is waiting for its child jobs to complete. */
  WAITING_CHILDREN = "waiting-children",
}

registerEnumType(JobStatus, { name: "JobStatus" });
