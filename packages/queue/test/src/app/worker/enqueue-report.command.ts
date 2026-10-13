import { BaseCommand, Command } from "@nest-boot/command";
import { Inject } from "@nestjs/common";

import { ReportsQueue } from "./reports.queue.js";

/** A normal application command that produces work without starting consumers. */
@Command({ paths: [["report:enqueue"]] })
export class EnqueueReportCommand extends BaseCommand {
  constructor(@Inject(ReportsQueue) private readonly reports: ReportsQueue) {
    super();
  }

  async execute(): Promise<void> {
    const job = await this.reports.add("report", {});
    this.context.stdout.write(`ENQUEUED:${String(job.id)}\n`);
  }
}
