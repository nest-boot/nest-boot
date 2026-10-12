import "reflect-metadata";

import assert from "node:assert/strict";

import { NestFactory } from "@nestjs/core";

assert(import.meta.resolve("@nest-boot/database"));
assert.throws(() => import.meta.resolve("@mikro-orm/decorators/legacy"), {
  code: "ERR_MODULE_NOT_FOUND",
});
const { QueueModule } = await import("@nest-boot/queue");
const app = await NestFactory.createApplicationContext(QueueModule, {
  logger: false,
  abortOnError: false,
});
await app.close();
console.log(
  "Packed plain queue starts with database installed and decorators absent",
);
