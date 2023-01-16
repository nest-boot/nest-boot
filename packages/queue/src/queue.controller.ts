import { Controller, Get, Param } from "@nestjs/common";

import { QueueExplorer } from "./queue.explorer";

@Controller("queue-dashboard/api/queues")
export class QueueController {
  constructor(private readonly queueExplorer: QueueExplorer) {}

  @Get()
  async list(): Promise<any> {
    return await Promise.all(
      [...this.queueExplorer.queues.keys()].map(
        async (name) => await this.get(name)
      )
    );
  }

  @Get(":name")
  async get(@Param("name") name: string): Promise<any> {
    const queue = this.queueExplorer.queues.get(name);

    if (typeof queue !== "undefined") {
      return {
        name: queue.name,
        ...(await queue.getJobCounts(
          "completed",
          "failed",
          "delayed",
          "active",
          "wait",
          "paused",
          "repeat"
        )),
        status: (await queue.isPaused()) ? "paused" : "active",
      };
    }

    return null;
  }

  @Get(":name/jobs")
  getJobs(@Param("name") name: string): string {
    return "queues";
  }
}
