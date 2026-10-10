/** Enumeration of possible BullMQ job statuses persisted in the database. */
export enum JobStatus {
  /** Job is actively being processed. */
  ACTIVE = "active",
  /** Job has completed successfully. */
  COMPLETED = "completed",
  /** Job is delayed and will be processed later. */
  DELAYED = "delayed",
  /** Job has failed after exhausting all retry attempts. */
  FAILED = "failed",
  /** Job is waiting in the prioritized queue. */
  PRIORITIZED = "prioritized",
  /** Job status is unknown. */
  UNKNOWN = "unknown",
  /** Job is waiting in the queue to be processed. */
  WAITING = "waiting",
  /** Job is waiting for its child jobs to complete. */
  WAITING_CHILDREN = "waiting-children",
}
