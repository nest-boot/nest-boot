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
      import { InjectQueue, Processor } from "@nest-boot/queue";
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
      code: 'import { BullModule as BullModule } from "@nestjs/bullmq";',
      output: 'import { QueueModule as BullModule } from "@nest-boot/queue";',
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import Integration from "@nestjs/bullmq";',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import { BullModule as Tasks } from "@nestjs/bullmq"; Tasks.forRoot({});',
      output:
        'import { QueueModule as Tasks } from "@nest-boot/queue"; Tasks.forRoot({});',
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import { type BullModuleOptions, BullMQHealthIndicator } from "@nest-boot/bullmq";',
      output:
        'import { type QueueModuleOptions as BullModuleOptions, QueueHealthIndicator as BullMQHealthIndicator } from "@nest-boot/queue";',
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import * as Bull from "@nestjs/bullmq"; Bull.BullModule.forRoot({});',
      output: null,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    {
      code: 'import { "BullModule" as Tasks } from "@nestjs/bullmq";',
      output: 'import { QueueModule as Tasks } from "@nest-boot/queue";',
      errors: [{ messageId: "replaceQueueImport" }],
    },
    // Importing from @nestjs/bullmq, should be replaced with @nest-boot/queue
    {
      code: /* typescript */ `
        import { BullModule } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import { QueueModule as BullModule } from "@nest-boot/queue";
      `,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    // Processor related imports
    {
      code: /* typescript */ `
        import { Processor, InjectQueue } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import { Processor, InjectQueue } from "@nest-boot/queue";
      `,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    // Type import
    {
      code: /* typescript */ `
        import type { BullModuleOptions } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import type { QueueModuleOptions as BullModuleOptions } from "@nest-boot/queue";
      `,
      errors: [{ messageId: "replaceQueueImport" }],
    },
    // Decorator imports
    {
      code: /* typescript */ `
        import { OnQueueActive, OnQueueCompleted } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import { OnQueueActive, OnQueueCompleted } from "@nest-boot/queue";
      `,
      errors: [{ messageId: "replaceQueueImport" }],
    },
  ],
});
