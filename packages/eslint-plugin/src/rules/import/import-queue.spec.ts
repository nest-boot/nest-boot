import { tester } from "../../utils/tester.js";
import rule from "./import-queue.js";

tester.run("import-queue", rule, {
  valid: [
    // Correct import source
    /* typescript */ `
      import { QueueModule } from "@nest-boot/queue";
    `,
    // Importing from another package
    /* typescript */ `
      import { Module } from "@nestjs/common";
    `,
    // Named import
    /* typescript */ `
      import { BaseQueue, Processor } from "@nest-boot/queue";
    `,
    // Default import
    /* typescript */ `
      import BullMQ from "@nest-boot/queue";
    `,
    // Importing from bullmq core package (should not be replaced)
    /* typescript */ `
      import { Queue, Worker } from "bullmq";
    `,
  ],
  invalid: [
    {
      code: 'import { WorkerHost } from "@nestjs/bullmq";',
      output: 'import { BaseProcessor as WorkerHost } from "@nest-boot/queue";',
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import { BullModule as BullModule } from "@nestjs/bullmq";',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import Integration from "@nestjs/bullmq";',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import { BullModule as Tasks } from "@nestjs/bullmq"; Tasks.forRoot({});',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import { type BullModuleOptions, BullMQHealthIndicator } from "@nest-boot/bullmq";',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import * as Bull from "@nestjs/bullmq"; Bull.BullModule.forRoot({});',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import { "BullModule" as Tasks } from "@nestjs/bullmq";',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    // Importing from @nestjs/bullmq, should be replaced with @nest-boot/queue
    {
      code: /* typescript */ `
        import { BullModule } from "@nestjs/bullmq";
      `,
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    // Processor related imports
    {
      code: /* typescript */ `
        import { Processor, InjectQueue } from "@nestjs/bullmq";
      `,
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    // Type import
    {
      code: /* typescript */ `
        import type { BullModuleOptions } from "@nestjs/bullmq";
      `,
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import type { QueueModuleOptions } from "@nest-boot/bullmq"; const options: QueueModuleOptions = { connection: { host: "redis", port: 6379 } };',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    // Decorator imports
    {
      code: /* typescript */ `
        import { OnQueueActive, OnQueueCompleted } from "@nestjs/bullmq";
      `,
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
  ],
});
