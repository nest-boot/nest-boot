import "reflect-metadata";

import assert from "node:assert/strict";

import type { FilterQuery } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { QueueModule, type QueueModuleOptions } from "@nest-boot/queue";
import {
  entities,
  getJobSchemaOptions,
  Job,
  JobService,
} from "@nest-boot/queue/persistence";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

for (const dependency of [
  "@nest-boot/graphql",
  "@nest-boot/graphql-connection",
  "@nestjs/graphql",
]) {
  assert.throws(() => import.meta.resolve(dependency), {
    code: "ERR_MODULE_NOT_FOUND",
  });
}

const options: QueueModuleOptions<FilterQuery<Job>> = {
  getJobReadFilter: () => null,
};

@Module({
  imports: [
    QueueModule.forRoot(options),
    DatabaseModule.forRoot({
      driver: PgliteDriver,
      dbName: "memory://",
      entities,
      ...getJobSchemaOptions(),
    }),
  ],
})
class DatabaseQueueModule {}

const app = await NestFactory.createApplicationContext(DatabaseQueueModule, {
  logger: false,
  abortOnError: false,
});
try {
  assert(app.get(JobService) instanceof JobService);
  await assert.rejects(app.get(JobService).getJob("email:1"), {
    message: "Job access is not configured for this identity",
  });
  console.log("Packed queue discovers ORM queries without GraphQL peers");
} finally {
  await app.close();
}
