import "reflect-metadata";

import assert from "node:assert/strict";

import { QueueModule } from "@nest-boot/queue";
import { NestFactory } from "@nestjs/core";

for (const dependency of [
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
console.log("Packed plain queue starts without database or GraphQL peers");
