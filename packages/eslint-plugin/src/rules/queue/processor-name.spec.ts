import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import { tester } from "../../utils/tester.js";
import rule from "./processor-name.js";

// Basic name checks also work without a TypeScript program.
const syntaxTester = new RuleTester({ languageOptions: { parser } });
syntaxTester.run("processor-name", rule, {
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
    "@Processor(makeQueue()) class DynamicProcessor {}",
    "@Processor() class IncompleteProcessor {}",
    "const Selected = makeQueue(); @Processor(Selected) class DynamicProcessor {}",
    "@OtherDecorator(EmailQueue) class OtherProcessor {}",
    "@Processor(Reports) class ReportsProcessor {}",
  ],
  invalid: [
    ...[
      ["EmailQueue", "SmsProcessor", "EmailProcessor"],
      ["EmailQueue", "EmailWorker", "EmailProcessor"],
      ["JobQueue", "SyncProcessor", "JobProcessor"],
      ["Reports", "ReportsWorker", "ReportsProcessor"],
    ].map(([queueName, actualName, expectedName]) => ({
      code: `@Processor(${queueName}) class ${actualName} extends BaseProcessor {}`,
      errors: [
        {
          messageId: "processorName" as const,
          data: { queueName, expectedName },
        },
      ],
    })),
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

tester.run("processor-name with queue symbols", rule, {
  valid: [
    "class EmailQueue {} const Selected = EmailQueue; @Processor(Selected) class EmailProcessor {}",
    "class EmailQueue {} const queues = { selected: EmailQueue }; @Processor(queues.selected) class EmailProcessor {}",
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
