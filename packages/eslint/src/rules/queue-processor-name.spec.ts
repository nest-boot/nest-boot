import path from "node:path";

import { RuleTester } from "@typescript-eslint/rule-tester";
import { TSESLint } from "@typescript-eslint/utils";

import rule from "./queue-processor-name.js";

const syntaxRuleTester = new RuleTester();

syntaxRuleTester.run("queue-processor-name", rule, {
  valid: [
    "@Processor(EmailQueue) class EmailProcessor extends BaseProcessor {}",
    "@Processor(JobQueue) class JobProcessor extends BaseProcessor {}",
    "class UnrelatedProcessor extends BaseProcessor {}",
    'import { Processor } from "other-library"; @Processor(EmailQueue) class OtherProcessor {}',
    "function Processor() {} @Processor(EmailQueue) class OtherProcessor {}",
    'import { Processor } from "@nest-boot/queue"; function make(Processor: any) { @Processor(EmailQueue) class OtherProcessor {} }',
    'import { Processor as Consume } from "@nest-boot/queue"; @Consume(EmailQueue) class EmailProcessor {}',
    'import * as boot from "@nest-boot/queue"; @boot.Processor(EmailQueue) class EmailProcessor {}',
    'import { EmailQueue as SelectedQueue } from "./email.queue.js"; @Processor(SelectedQueue) class EmailProcessor {}',
    'import * as queues from "./queues.js"; @Processor(queues.EmailQueue) class EmailProcessor {}',
    'import * as queues from "./queues.js"; @Processor(queues["EmailQueue"]) class EmailProcessor {}',
    'import * as queues from "./queues.js"; @Processor(queues[1]) class NumericKeyProcessor {}',
    "@Processor(makeQueue()) class DynamicProcessor {}",
    "@Processor() class IncompleteProcessor {}",
    "const Selected = makeQueue(); @Processor(Selected) class DynamicProcessor {}",
    "@OtherDecorator(EmailQueue) class OtherProcessor {}",
    "@Processor(Reports) class ReportsProcessor {}",
  ],
  invalid: [
    {
      code: "@Processor(EmailQueue) class SmsProcessor extends BaseProcessor {}",
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
    {
      code: "@Processor(EmailQueue) class EmailWorker extends BaseProcessor {}",
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
    {
      code: "@Processor(JobQueue) class SyncProcessor extends BaseProcessor {}",
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "JobQueue", expectedName: "JobProcessor" },
        },
      ],
    },
    {
      code: "@Processor(Reports) class ReportsWorker extends BaseProcessor {}",
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "Reports", expectedName: "ReportsProcessor" },
        },
      ],
    },
    {
      code: 'import { Processor as Consume } from "@nest-boot/queue"; @Consume(EmailQueue) class OtherProcessor {}',
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
    {
      code: 'import * as boot from "@nest-boot/queue"; @boot.Processor(EmailQueue) class OtherProcessor {}',
      errors: [{ messageId: "processorName" }],
    },
    {
      code: 'import { EmailQueue as SelectedQueue } from "./email.queue.js"; @Processor(SelectedQueue) class SelectedProcessor {}',
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
    {
      code: 'import * as queues from "./queues.js"; @Processor(queues.EmailQueue) class OtherProcessor {}',
      errors: [{ messageId: "processorName" }],
    },
    {
      code: 'import * as boot from "@nest-boot/queue"; const { Processor: Consume } = boot; @Consume(EmailQueue) class OtherProcessor {}',
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
    {
      code: 'import { Processor } from "@nest-boot/queue"; function scope() { type Processor = string; @Processor(EmailQueue) class OtherProcessor {} }',
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
    {
      code: "@Processor(EmailQueue) export default class {}",
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
  ],
});

const typedRuleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts*"],
        defaultProject: "tsconfig.json",
      },
      tsconfigRootDir: path.resolve(import.meta.dirname, "../.."),
    },
  },
});

typedRuleTester.run("queue-processor-name", rule, {
  valid: [
    "class EmailQueue {} const Selected = EmailQueue; @Processor(Selected) class EmailProcessor {}",
    "class EmailQueue {} const queues = { selected: EmailQueue }; @Processor(queues.selected) class EmailProcessor {}",
    'import EmailQueue from "./email.queue.js"; class LocalQueue {} @Processor(LocalQueue) class LocalProcessor {} void EmailQueue;',
  ],
  invalid: [
    {
      code: "class EmailQueue {} const Selected = EmailQueue; @Processor(Selected) class SelectedProcessor {}",
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
    {
      code: "class EmailQueue {} const queues = { selected: EmailQueue }; @Processor(queues.selected) class OtherProcessor {}",
      errors: [
        {
          messageId: "processorName",
          data: { queueName: "EmailQueue", expectedName: "EmailProcessor" },
        },
      ],
    },
  ],
});

describe("queue-processor-name with non-TypeScript parser", () => {
  it("does not throw when parserServices lacks TypeScript node maps", () => {
    const linter = new TSESLint.Linter();
    const messages = linter.verify("export class PlainJs {}", [
      {
        plugins: {
          "nest-boot": {
            rules: { "queue-processor-name": rule },
          },
        },
        rules: { "nest-boot/queue-processor-name": "error" },
      },
    ]);
    expect(messages).toEqual([]);
  });
});
