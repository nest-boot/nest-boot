import { JobState } from "bullmq";

import { JobStatus } from "../enums/job-status.enum";

/**
 * 将 BullMQ 的任务状态转换为内部 JobStatus 枚举
 * @param state BullMQ 任务状态或 "unknown"
 * @returns 对应的 JobStatus 枚举值
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
