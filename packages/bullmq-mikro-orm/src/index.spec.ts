import * as publicApi from ".";
import { BullMQMikroORMModule } from "./bullmq-mikro-orm.module";
import { JobEntity } from "./entities/job.entity";
import { JobStatus } from "./enums/job-status.enum";

describe("public API", () => {
  it("should export the module, entity, options, and status enum", () => {
    expect(publicApi.BullMQMikroORMModule).toBe(BullMQMikroORMModule);
    expect(publicApi.JobEntity).toBe(JobEntity);
    expect(publicApi.JobStatus).toBe(JobStatus);
  });
});
