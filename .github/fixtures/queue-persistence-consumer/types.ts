import type { FilterQuery } from "@mikro-orm/core";
import { QueueModule, type QueueModuleOptions } from "@nest-boot/queue";
import type { Job, JobService } from "@nest-boot/queue/persistence";

const options: QueueModuleOptions<FilterQuery<Job>> = {
  getJobReadFilter: () => ({ queue: "email" }),
};
QueueModule.forRoot(options);

declare const service: JobService;
const job: Job | null = await service.getJob("email:1");
void job;
