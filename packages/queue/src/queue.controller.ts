import { Controller, Get, Param } from "@nestjs/common";
import { parse as redisInfoParse } from "redis-info";

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
      const [
        redisInfoString,
        isPaused,
        workers,
        jobCounts,
        completedMetrics,
        failedMetrics,
      ] = await Promise.all([
        (await queue.client).info(),
        queue.isPaused(),
        queue.getWorkers(),
        queue.getJobCounts(
          "completed",
          "failed",
          "delayed",
          "active",
          "wait",
          "paused",
          "repeat"
        ),
        queue.getMetrics("completed"),
        queue.getMetrics("failed"),
      ]);

      const redisInfoObject = redisInfoParse(redisInfoString);

      return {
        name: queue.name,
        ...jobCounts,
        status: isPaused ? "paused" : "active",
        workers,
        client: {
          redisVersion: redisInfoObject.redis_version,
          usedMemory: Number(redisInfoObject.used_memory),
          maxMemory: Number(redisInfoObject.maxmemory),
          usedConnection: Number(redisInfoObject.connected_clients),
          maxConnection: Number((redisInfoObject as any).maxclients),
        },
        metrics: {
          completed: completedMetrics,
          failed: failedMetrics,
        },
      };
    }

    return null;
  }

  @Get(":name/jobs")
  getJobs(@Param("name") name: string): string {
    return "queues";
  }
}
