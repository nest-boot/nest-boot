import { Can } from "@nest-boot/common";
import { Controller, Get, Param, Put, Query } from "@nestjs/common";

import { JobQueriesDto } from "../dto/job-queries.dto";
import { Jobs } from "../interfaces/jobs.interface";
import { QueueMetrics } from "../interfaces/queue-metrics.interface";
import { RedisInfo } from "../interfaces/redis-info.interface";
import { Schedule } from "../interfaces/schedule.interface";
import { Worker } from "../interfaces/worker.interface";
import { QueueInfoService } from "../services/queue-info.service";

@Controller("/api/queues")
export class QueueController {
  constructor(private queueInfoService: QueueInfoService) {
    return this;
  }

  @Can("QUEUE_READ")
  @Get()
  getQueues(): string[] {
    return this.queueInfoService.getQueues();
  }

  @Can("QUEUE_READ")
  @Get(":name/metrics")
  async getQueue(@Param("name") name: string): Promise<QueueMetrics> {
    return await this.queueInfoService.getQueue(name);
  }

  @Can("QUEUE_READ")
  @Get(":name/jobs")
  async getJobs(
    @Param("name") name: string,
    @Query() query: JobQueriesDto
  ): Promise<Jobs> {
    const { type, page = 1 } = query;
    return await this.queueInfoService.getJobs(name, type, page);
  }

  @Can("QUEUE_READ")
  @Get(":name/workers")
  async getWorkers(@Param("name") name: string): Promise<Worker[]> {
    return await this.queueInfoService.getWorkers(name);
  }

  @Can("QUEUE_READ")
  @Get(":name/schedules")
  async getSchedules(@Param("name") name: string): Promise<Schedule[]> {
    return await this.queueInfoService.getSchedules(name);
  }

  @Can("QUEUE_READ")
  @Get(":name/redis-info")
  async getRedisInfo(@Param("name") name: string): Promise<RedisInfo> {
    return await this.queueInfoService.getRedisInfo(name);
  }

  @Can("QUEUE_UPDATE")
  @Put(":name/pause")
  async pause(@Param("name") name: string): Promise<void> {
    return await this.queueInfoService.pause(name);
  }

  @Can("QUEUE_UPDATE")
  @Put(":name/resume")
  async resume(@Param("name") name: string): Promise<void> {
    return await this.queueInfoService.resume(name);
  }
}
