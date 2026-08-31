import { BullMQMikroORMModule } from "./bullmq-mikro-orm.module.js";
import { JobEntity } from "./entities/job.entity.js";
import { JobStatus } from "./enums/job-status.enum.js";
import * as publicApi from "./index.js";

describe("public API", () => {
  it("should export the module, entity, options, and status enum", () => {
    expect(publicApi.BullMQMikroORMModule).toBe(BullMQMikroORMModule);
    expect(publicApi.JobEntity).toBe(JobEntity);
    expect(publicApi.JobStatus).toBe(JobStatus);
  });
});
