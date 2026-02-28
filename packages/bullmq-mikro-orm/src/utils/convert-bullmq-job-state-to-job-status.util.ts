import { JobState } from "bullmq";

import { JobStatus } from "../enums/job-status.enum";

/**
 * Converts a BullMQ job state to the internal JobStatus enum.
 * @param state - The BullMQ job state or "unknown".
 * @returns The corresponding JobStatus enum value.
 */
export function convertBullmqJobStateToJobStatus(
  state: JobState | "unknown",
): JobStatus {
  switch (state) {
    case "active":
      return JobStatus.ACTIVE;

    case "completed":
      return JobStatus.COMPLETED;

    case "delayed":
      return JobStatus.DELAYED;

    case "failed":
      return JobStatus.FAILED;

    case "prioritized":
      return JobStatus.PRIORITIZED;

    case "waiting":
      return JobStatus.WAITING;

    case "waiting-children":
      return JobStatus.WAITING_CHILDREN;

    default:
      return JobStatus.UNKNOWN;
  }
}
