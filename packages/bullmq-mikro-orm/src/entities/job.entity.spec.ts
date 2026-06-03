import { JobStatus } from "../enums/job-status.enum";
import { JobEntity } from "./job.entity";

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

  it("should emit decorator metadata when Opt exists at runtime", () => {
    jest.isolateModules(() => {
      jest.doMock("@mikro-orm/core", () => {
        const actual = jest.requireActual("@mikro-orm/core");

        return {
          ...actual,
          Opt: function Opt() {
            return undefined;
          },
        };
      });

      const isolatedModule =
        jest.requireActual<typeof import("./job.entity")>("./job.entity");

      expect(isolatedModule.JobEntity).toBeDefined();
      jest.dontMock("@mikro-orm/core");
    });
  });
});
