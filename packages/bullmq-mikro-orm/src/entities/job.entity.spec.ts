import { JobStatus } from "../enums/job-status.enum.js";
import { JobEntity } from "./job.entity.js";

class TestJobEntity extends JobEntity {}

describe("JobEntity", () => {
  it("should initialize timestamp defaults", () => {
    const entity = new TestJobEntity();

    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.updatedAt).toBeInstanceOf(Date);
  });

  it("should expose persisted job status values", () => {
    expect(JobStatus).toEqual({
      ACTIVE: "active",
      COMPLETED: "completed",
      DELAYED: "delayed",
      FAILED: "failed",
      PRIORITIZED: "prioritized",
      UNKNOWN: "unknown",
      WAITING: "waiting",
      WAITING_CHILDREN: "waiting-children",
    });
  });

  it("should load entity metadata in an isolated module", async () => {
    vi.resetModules();

    const isolatedModule = await import("./job.entity.js");

    expect(isolatedModule.JobEntity).toBeDefined();
  });
});
