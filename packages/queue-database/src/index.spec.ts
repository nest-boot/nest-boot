import { JobEntity } from "./entities/job.entity.js";
import { JobStatus } from "./enums/job-status.enum.js";
import * as publicApi from "./index.js";
import { QueueDatabaseModule } from "./queue-database.module.js";

describe("public API", () => {
  it("should export the module, entity, options, and status enum", () => {
    expect(publicApi.QueueDatabaseModule).toBe(QueueDatabaseModule);
    expect(publicApi.JobEntity).toBe(JobEntity);
    expect(publicApi.JobStatus).toBe(JobStatus);
  });
});
