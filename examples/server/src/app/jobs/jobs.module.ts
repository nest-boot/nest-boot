import { QueueModule } from '@nest-boot/queue';
import { QueueDatabaseModule } from '@nest-boot/queue-database';
import { ScheduleModule } from '@nest-boot/schedule';
import { Module } from '@nestjs/common';

import { Job } from './entities/job.entity.js';
import { JobResolver } from './job.resolver.js';
import { JobService } from './job.service.js';

/** 持久化当前应用的队列任务，并注册任务历史的定时清理。 */
@Module({
  imports: [
    QueueModule.forRootAsync({
      useFactory: () => ({
        prefix: process.env.BULLMQ_PREFIX ?? 'nest-boot-example',
      }),
    }),
    ScheduleModule,
    QueueDatabaseModule.forRoot({ jobEntity: Job }),
  ],
  providers: [JobService, JobResolver],
})
export class JobsModule {}
