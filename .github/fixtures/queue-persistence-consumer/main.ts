import "reflect-metadata";

import assert from "node:assert/strict";

import { PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { QueueModule } from "@nest-boot/queue";
import { Job, JobService } from "@nest-boot/queue/persistence";
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

@Module({
  imports: [
    QueueModule,
    DatabaseModule.forRoot({
      driver: PgliteDriver,
      dbName: "memory://",
      entities: [Job],
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
  console.log("Packed queue discovers database history without GraphQL peers");
} finally {
  await app.close();
}
