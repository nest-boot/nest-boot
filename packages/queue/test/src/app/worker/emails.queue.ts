import { BaseQueue, Queue } from "@nest-boot/queue";
import { z } from "zod";

@Queue("emails")
export class EmailsQueue extends BaseQueue {
  readonly jobSchemas = {
    email: {
      data: z.object({
        delay: z.number().optional(),
        userId: z.string().optional(),
      }),
      result: z.string(),
    },
  };
  constructor() {
    super({ prefix: process.env.QUEUE_TEST_PREFIX });
  }
}
