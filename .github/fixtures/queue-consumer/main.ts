import "reflect-metadata";

import assert from "node:assert/strict";

import {
  BaseProcessor,
  BaseQueue,
  Queue,
  Processor,
  QueueModule,
} from "@nest-boot/queue";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

for (const dependency of [
  "@nestjs/bullmq",
  "@nest-boot/database",
  "@nest-boot/graphql",
  "@mikro-orm/core",
  "@nestjs/graphql",
]) {
  assert.throws(() => import.meta.resolve(dependency), {
    code: "ERR_MODULE_NOT_FOUND",
  });
}

const app = await NestFactory.createApplicationContext(
  QueueModule.forRoot({}),
  {
    logger: false,
    abortOnError: false,
  },
);
await app.close();

@Queue({ name: "consumer-only" })
class ConsumerQueue extends BaseQueue {}

@Processor(ConsumerQueue)
class Consumer extends BaseProcessor {
  async process(): Promise<void> {}
}

@Module({ imports: [QueueModule], providers: [Consumer] })
class UnregisteredConsumerModule {}

await assert.rejects(
  NestFactory.createApplicationContext(UnregisteredConsumerModule, {
    logger: false,
    abortOnError: false,
  }),
  /Processor.*consumer-only.*ConsumerQueue.*providers/,
);

@Queue({ name: "history", persistence: { enabled: true } })
class HistoryQueue extends BaseQueue {}

@Module({ imports: [QueueModule], providers: [HistoryQueue] })
class MissingDatabaseModule {}

await assert.rejects(
  NestFactory.createApplicationContext(MissingDatabaseModule, {
    logger: false,
    abortOnError: false,
  }),
  /Queue "history" has persistence.enabled: true.*DatabaseModule/,
);
console.log("Packed plain queue starts without database or GraphQL peers");
