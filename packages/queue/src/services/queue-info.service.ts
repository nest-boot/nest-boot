import { Redis } from "@nest-boot/redis";
import { Injectable, NotFoundException } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { Repeat } from "bullmq";
import { kebabCase, pick } from "lodash";
import { parse as redisInfoParse } from "redis-info";

import { BaseQueue } from "../base.queue";
import { JobType } from "../enums/job-type.enum";
import { Jobs } from "../interfaces/jobs.interface";
import { QueueMetrics } from "../interfaces/queue-metrics.interface";
import { RedisInfo } from "../interfaces/redis-info.interface";
import { Schedule } from "../interfaces/schedule.interface";
import { Worker } from "../interfaces/worker.interface";
import getDataInfo from "../utils/getDataInfo";
import { QueueManagerService } from "./queue-manager.service";

@Injectable()
export class QueueInfoService {
  private readonly queueNames: string[] = [];

  private readonly repeats: { [key: string]: Repeat } = {};

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly queueManagerService: QueueManagerService,
    private readonly redis: Redis
  ) {}

  getQueueProviders(): InstanceWrapper<BaseQueue>[] {
    return this.discoveryService
      .getProviders()
      .filter((wrapper: InstanceWrapper<BaseQueue>) => {
        return wrapper.instance instanceof BaseQueue;
      });
  }

  init(): void {
    this.getQueueProviders().forEach((item) => {
      const queueName = kebabCase(item.name);
      this.queueNames.push(queueName);

      this.repeats[queueName] = new Repeat(item.name, {
        connection: this.redis,
      });
    });
  }

  // 获取所有队列名
  getQueues(): string[] {
    return this.queueNames;
  }

  // 获取单个队列详情
  async getQueue(name: string): Promise<QueueMetrics> {
    if (!this.queueNames.includes(name)) {
      throw new NotFoundException({});
    }

    const queue = this.queueManagerService.getQuene(name);

    const isPaused = await queue.isPaused();

    // 还在队列中的 job 类型
    const inQueueJobTypes = [JobType.WAIT, JobType.ACTIVE, JobType.DELAYED];

    // 已经处理过的 job 类型
    const processedJobTypes = [JobType.COMPLETED, JobType.FAILED];

    // 各类型的 job 数量
    const AllJobCounts = await queue.getJobCounts([
      ...inQueueJobTypes,
      ...processedJobTypes,
    ]);

    const {
      wait = 0,
      active = 0,
      delayed = 0,
      completed = 0,
      failed = 0,
    } = AllJobCounts;

    // 查出所有已经处理过的任务，使用已经处理过的任务做为统计数据源
    const processedJobs = await queue.getJobs(processedJobTypes);

    const responseTimes: number[] = [];
    const processTimes: number[] = [];

    processedJobs.forEach((job) => {
      const { timestamp, processedOn, finishedOn = 0 } = job;

      // 排队时间
      const responseTime = processedOn - timestamp;

      // job 处理时间
      const processTime = finishedOn - processedOn;

      if (responseTime > 0) {
        responseTimes.push(responseTime);
      }

      if (processTime > 0) {
        processTimes.push(processTime);
      }
    });

    const {
      min: minResponseTime,
      median: medianResponseTime,
      max: maxResponseTime,
    } = getDataInfo(responseTimes);
    const {
      min: minProcessTime,
      median: medianProcessTime,
      max: maxProcessTime,
    } = getDataInfo(processTimes);

    return {
      waiting: wait,
      active,
      delayed,
      completed,
      failed,
      isPaused,
      responseTime: {
        max: maxResponseTime,
        min: minResponseTime,
        median: medianResponseTime,
      },
      processTime: {
        max: maxProcessTime,
        min: minProcessTime,
        median: medianProcessTime,
      },
    };
  }

  // 查询队列内 jobs , 每页 20 个
  async getJobs(name: string, type: string, page?: number): Promise<Jobs> {
    if (!this.queueNames.includes(name)) {
      throw new NotFoundException();
    }

    const queue = this.queueManagerService.getQuene(name);

    const { [type]: total } = await queue.getJobCounts([type]);

    let innerPage = 1;
    if (page > 0) {
      innerPage = page;
    }

    const end = innerPage * 20;
    const jobs = await queue.getJobs([type], end - 19, end);

    const result = jobs.map((job) => {
      const {
        id,
        name: jobName,
        data,
        opts,
        timestamp,
        finishedOn,
        processedOn,
      } = job;
      const waited = processedOn ? processedOn - timestamp : undefined;
      const run = finishedOn ? finishedOn - processedOn : undefined;

      const { progress } = job;

      return {
        id,
        name: jobName,
        data,
        opts,
        timestamp,
        finishedOn,
        processedOn,
        waited,
        run,
        progress,
      };
    });

    return {
      page: innerPage,
      pageSize: 20,
      total,
      jobs: result,
    };
  }

  // 查询 workers
  async getWorkers(name: string): Promise<Worker[]> {
    if (!this.queueNames.includes(name)) {
      throw new NotFoundException();
    }

    const queue = this.queueManagerService.getQuene(name);

    return await queue.getWorkers();
  }

  // 定时任务列表
  async getSchedules(name: string): Promise<Schedule[]> {
    if (!this.queueNames.includes(name)) {
      throw new NotFoundException();
    }

    const repeat = this.repeats[name];

    return await repeat.getRepeatableJobs();
  }

  // 获取 redis 信息
  async getRedisInfo(name: string): Promise<RedisInfo> {
    if (!this.queueNames.includes(name)) {
      throw new NotFoundException();
    }

    const queue = this.queueManagerService.getQuene(name);

    const redisInfo = await (await queue.getClient()).info();

    return pick(redisInfoParse(redisInfo), [
      "connected_clients",
      "used_memory_human",
      "redis_version",
      "redis_mode",
      "total_system_memory_human",
      "used_memory_peak_human",
      "used_memory_peak_perc",
    ]);
  }

  // 暂停队列
  async pause(name: string): Promise<void> {
    if (!this.queueNames.includes(name)) {
      throw new NotFoundException();
    }

    const queue = this.queueManagerService.getQuene(name);

    await queue.pause();
  }

  // 恢复暂停的队列
  async resume(name: string): Promise<void> {
    if (!this.queueNames.includes(name)) {
      throw new NotFoundException();
    }

    const queue = this.queueManagerService.getQuene(name);

    await queue.resume();
  }
}
