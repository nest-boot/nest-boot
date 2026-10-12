import {
  QueueModule,
  type QueueModuleOptions,
  withQueueDatabaseConfig,
  type Job,
  type JobService,
} from "@nest-boot/queue";
const options: QueueModuleOptions = { graphql: false };
QueueModule.forRoot(options);
const ormOptions = withQueueDatabaseConfig(
  { dbName: "typed-database" as const },
  "tasks",
);
const dbName: "typed-database" = ormOptions.dbName;
void dbName;

declare const service: JobService;
const job: Job | null = await service.getJob("email:1");
void job;
