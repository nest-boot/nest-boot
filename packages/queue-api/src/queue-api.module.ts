import { QueueModule } from "@nest-boot/queue";
import { Global, Module } from "@nestjs/common";

import { JobProcessor } from "./processors/job.processor.js";
import { JobQueue } from "./queues/job.queue.js";
import { JobResolver } from "./resolvers/job.resolver.js";
import { JobService } from "./services/job.service.js";

/** Authenticated Job APIs using the application's global database and auth configuration. */
@Global()
@Module({
  imports: [QueueModule],
  providers: [JobQueue, JobProcessor, JobService, JobResolver],
  exports: [JobService],
})
export class QueueApiModule {}
