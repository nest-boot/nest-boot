import { tester } from "../../utils/tester";
import rule from "./import-bullmq";

tester.run("import-bullmq", rule, {
  valid: [
    // Correct import source
    /* typescript */ `
      import { BullModule } from "@nest-boot/bullmq";
    `,
    // Importing from another package
    /* typescript */ `
      import { Module } from "@nestjs/common";
    `,
    // Named import
    /* typescript */ `
      import { InjectQueue, Processor } from "@nest-boot/bullmq";
    `,
    // Default import
    /* typescript */ `
      import BullMQ from "@nest-boot/bullmq";
    `,
    // Importing from bullmq core package (should not be replaced)
    /* typescript */ `
      import { Queue, Worker } from "bullmq";
    `,
  ],
  invalid: [
    // Importing from @nestjs/bullmq, should be replaced with @nest-boot/bullmq
    {
      code: /* typescript */ `
        import { BullModule } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import { BullModule } from "@nest-boot/bullmq";
      `,
      errors: [{ messageId: "replaceBullmqImport" }],
    },
    // Processor related imports
    {
      code: /* typescript */ `
        import { Processor, InjectQueue } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import { Processor, InjectQueue } from "@nest-boot/bullmq";
      `,
      errors: [{ messageId: "replaceBullmqImport" }],
    },
    // Type import
    {
      code: /* typescript */ `
        import type { BullModuleOptions } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import type { BullModuleOptions } from "@nest-boot/bullmq";
      `,
      errors: [{ messageId: "replaceBullmqImport" }],
    },
    // Decorator imports
    {
      code: /* typescript */ `
        import { OnQueueActive, OnQueueCompleted } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import { OnQueueActive, OnQueueCompleted } from "@nest-boot/bullmq";
      `,
      errors: [{ messageId: "replaceBullmqImport" }],
    },
  ],
});
