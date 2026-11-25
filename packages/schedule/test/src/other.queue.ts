import { BaseQueue, Queue } from "@nest-boot/queue";
import { z } from "zod";

@Queue("other")
export class OtherQueue extends BaseQueue {
  readonly jobSchemas = {
    ping: {
      data: z.object({}),
      result: z.string(),
    },
  };

  constructor() {
    super({ prefix: process.env.SCHEDULE_TEST_PREFIX });
  }
}
