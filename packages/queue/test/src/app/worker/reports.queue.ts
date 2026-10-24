import { BaseQueue, Queue } from "@nest-boot/queue";
import { z } from "zod";

@Queue("reports")
export class ReportsQueue extends BaseQueue {
  readonly jobSchemas = {
    report: {
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

export type ReportData = z.input<ReportsQueue["jobSchemas"]["report"]["data"]>;
