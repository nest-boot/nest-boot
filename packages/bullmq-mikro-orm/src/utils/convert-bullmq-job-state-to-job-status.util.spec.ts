import { JobStatus } from "../enums/job-status.enum.js";
import { convertBullmqJobStateToJobStatus } from "./convert-bullmq-job-state-to-job-status.util.js";

describe("convertBullmqJobStateToJobStatus", () => {
  it.each([
    ["active", JobStatus.ACTIVE],
    ["completed", JobStatus.COMPLETED],
    ["delayed", JobStatus.DELAYED],
    ["failed", JobStatus.FAILED],
    ["prioritized", JobStatus.PRIORITIZED],
    ["waiting", JobStatus.WAITING],
    ["waiting-children", JobStatus.WAITING_CHILDREN],
    ["unknown", JobStatus.UNKNOWN],
  ] as const)("should convert %s to %s", (state, status) => {
    expect(convertBullmqJobStateToJobStatus(state)).toBe(status);
  });

  it("should convert unsupported states to unknown", () => {
    expect(convertBullmqJobStateToJobStatus("paused" as never)).toBe(
      JobStatus.UNKNOWN,
    );
  });
});
