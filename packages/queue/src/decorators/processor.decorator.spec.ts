import "reflect-metadata";

import { z } from "zod";

import type { Job } from "../interfaces/job.interface.js";
import { BaseProcessor } from "../processors/base.processor.js";
import { BaseQueue } from "../queues/base.queue.js";
import { Processor } from "./processor.decorator.js";
import { Queue } from "./queue.decorator.js";

it("checks every named method, exact job parameters and per-job results during compilation", () => {
  @Queue()
  class TypedQueue extends BaseQueue {
    readonly jobSchemas = {
      "send-email": {
        data: z.object({ to: z.string() }),
        result: z.object({ messageId: z.string() }),
      },
      welcome: { data: z.object({ userId: z.string() }) },
    };
  }
  class SendMethod extends BaseProcessor {
    async processSendEmail(_job: Job<TypedQueue, "send-email">) {
      await Promise.resolve();
      return { messageId: "sent" };
    }
  }
  @Processor(TypedQueue)
  class TypedProcessor extends SendMethod {
    async processWelcome(_job: Job<TypedQueue, "welcome">) {
      await Promise.resolve();
    }
  }
  /* eslint-disable @nest-boot/queue/processor-name -- Distinct fixture names identify intentional processor type errors. */
  // @ts-expect-error Missing processWelcome.
  @Processor(TypedQueue)
  class Missing extends SendMethod {}

  // @ts-expect-error A welcome method cannot return a business result.
  @Processor(TypedQueue)
  class WrongVoid extends SendMethod {
    async processWelcome(_job: Job<TypedQueue, "welcome">) {
      await Promise.resolve();
      return 123;
    }
  }

  // @ts-expect-error The send-email result must contain messageId.
  @Processor(TypedQueue)
  class WrongResult extends BaseProcessor {
    async processSendEmail(_job: Job<TypedQueue, "send-email">) {
      await Promise.resolve();
      return 123;
    }
    async processWelcome(_job: Job<TypedQueue, "welcome">) {
      await Promise.resolve();
    }
  }

  // @ts-expect-error A handler's parameter cannot refer to another job.
  @Processor(TypedQueue)
  class WrongJob extends BaseProcessor {
    async processSendEmail(_job: Job<TypedQueue, "welcome">) {
      await Promise.resolve();
      return { messageId: "sent" };
    }
    async processWelcome(_job: Job<TypedQueue, "welcome">) {
      await Promise.resolve();
    }
  }

  // @ts-expect-error any cannot bypass the job parameter check.
  @Processor(TypedQueue)
  class AnyJob extends BaseProcessor {
    async processSendEmail(_job: any) {
      await Promise.resolve();
      return { messageId: "sent" };
    }
    async processWelcome(_job: Job<TypedQueue, "welcome">) {
      await Promise.resolve();
    }
  }

  // @ts-expect-error Promise<any> cannot bypass the result check.
  @Processor(TypedQueue)
  class AnyResult extends BaseProcessor {
    async processSendEmail(_job: Job<TypedQueue, "send-email">): Promise<any> {
      await Promise.resolve();
      return 123;
    }
    async processWelcome(_job: Job<TypedQueue, "welcome">) {
      await Promise.resolve();
    }
  }

  @Processor(TypedQueue)
  class OptionalArguments extends SendMethod {
    async processWelcome(
      _job: Job<TypedQueue, "welcome">,
      _token?: string,
      _signal?: AbortSignal,
    ) {
      await Promise.resolve();
    }
  }

  // @ts-expect-error Worker tokens are strings.
  @Processor(TypedQueue)
  class WrongToken extends SendMethod {
    async processWelcome(_job: Job<TypedQueue, "welcome">, _token?: number) {
      await Promise.resolve();
    }
  }

  // @ts-expect-error Worker cancellation uses AbortSignal.
  @Processor(TypedQueue)
  class WrongSignal extends SendMethod {
    async processWelcome(
      _job: Job<TypedQueue, "welcome">,
      _token?: string,
      _signal?: Date,
    ) {
      await Promise.resolve();
    }
  }

  // @ts-expect-error Worker tokens may be undefined.
  @Processor(TypedQueue)
  class RequiredToken extends SendMethod {
    async processWelcome(_job: Job<TypedQueue, "welcome">, _token: string) {
      await Promise.resolve();
    }
  }

  // @ts-expect-error The Worker never supplies a fourth argument.
  @Processor(TypedQueue)
  class ExtraArgument extends SendMethod {
    async processWelcome(
      _job: Job<TypedQueue, "welcome">,
      _token: string | undefined,
      _signal: AbortSignal | undefined,
      _extra: string,
    ) {
      await Promise.resolve();
    }
  }

  // @ts-expect-error A generic process method is forbidden even when named methods exist.
  @Processor(TypedQueue)
  class Legacy extends TypedProcessor {
    async process(_job: Job<TypedQueue>) {
      await Promise.resolve();
    }
  }

  @Queue()
  class NoSchemasQueue extends BaseQueue {}
  // @ts-expect-error Consumers must declare concrete jobSchemas.
  @Processor(NoSchemasQueue)
  class NoSchemasProcessor extends BaseProcessor {}

  /* eslint-enable @nest-boot/queue/processor-name */

  // eslint-disable-next-line no-constant-condition -- Verify read-only accessors without mutating runtime instances.
  if (false) {
    const processor = new TypedProcessor();
    // @ts-expect-error The managed Worker reference is read-only.
    processor.worker = undefined;
    const queue = new TypedQueue();
    // @ts-expect-error The managed QueueEvents reference is read-only.
    queue.queueEvents = undefined;
  }

  expectTypeOf<"createWorker" | "closeWorker" | "on" | "eventHandlers">()
    .extract<keyof TypedProcessor>()
    .toBeNever();

  expect([
    TypedProcessor,
    Missing,
    WrongVoid,
    WrongResult,
    WrongJob,
    AnyJob,
    AnyResult,
    OptionalArguments,
    WrongToken,
    WrongSignal,
    RequiredToken,
    ExtraArgument,
    Legacy,
    NoSchemasProcessor,
  ]).toHaveLength(14);
});
