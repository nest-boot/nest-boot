import { tester } from "../../utils/tester";
import rule from "./import-bullmq";

tester.run("import-bullmq", rule, {
  valid: [
    // 正确的导入来源
    /* typescript */ `
      import { BullModule } from "@nest-boot/bullmq";
    `,
    // 从其他包导入
    /* typescript */ `
      import { Module } from "@nestjs/common";
    `,
    // 命名导入
    /* typescript */ `
      import { InjectQueue, Processor } from "@nest-boot/bullmq";
    `,
    // 默认导入
    /* typescript */ `
      import BullMQ from "@nest-boot/bullmq";
    `,
    // 从 bullmq 核心包导入（不应该被替换）
    /* typescript */ `
      import { Queue, Worker } from "bullmq";
    `,
  ],
  invalid: [
    // 从 @nestjs/bullmq 导入，应该替换为 @nest-boot/bullmq
    {
      code: /* typescript */ `
        import { BullModule } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import { BullModule } from "@nest-boot/bullmq";
      `,
      errors: [{ messageId: "replaceBullmqImport" }],
    },
    // Processor 相关导入
    {
      code: /* typescript */ `
        import { Processor, InjectQueue } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import { Processor, InjectQueue } from "@nest-boot/bullmq";
      `,
      errors: [{ messageId: "replaceBullmqImport" }],
    },
    // 类型导入
    {
      code: /* typescript */ `
        import type { BullModuleOptions } from "@nestjs/bullmq";
      `,
      output: /* typescript */ `
        import type { BullModuleOptions } from "@nest-boot/bullmq";
      `,
      errors: [{ messageId: "replaceBullmqImport" }],
    },
    // 装饰器导入
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
