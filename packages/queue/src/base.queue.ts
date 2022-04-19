/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BulkJobOptions,
  Job,
  JobsOptions,
  JobType,
  Queue as BullQueue,
  QueueScheduler,
  RedisClient,
  RepeatOptions,
  Worker,
} from "bullmq";
import { randomUUID } from "crypto";

export abstract class BaseQueue<T = any, R = any, N extends string = string> {
  queue?: BullQueue<T, R, N>;

  queueScheduler?: QueueScheduler;

  worker?: Worker<T, R, N>;

  async add(
    name: N,
    data: T,
    options?: JobsOptions
  ): Promise<Job<T, R, string>> {
    return await this.queue.add(name, data, {
      jobId: randomUUID(),
      ...(options || {}),
    });
  }

  async addBulk(
    jobs: {
      name: N;
      data: T;
      options?: BulkJobOptions;
    }[]
  ): Promise<Job<T, any, N>[]> {
    return await this.queue.addBulk(
      jobs.map((job) => ({
        ...job,
        opts: {
          jobId: randomUUID(),
          ...(job.options || {}),
        },
      }))
    );
  }

  async pause(): Promise<void> {
    return await this.queue.pause();
  }

  async resume(): Promise<void> {
    return await this.queue.resume();
  }

  async isPaused(): Promise<boolean> {
    return await this.queue.isPaused();
  }

  async getJob(jobId: string): Promise<Job<T, R>> {
    return await this.queue.getJob(jobId);
  }

  async getJobs(
    types: JobType | JobType[],
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<Job<any, any, string>[]> {
    return await this.queue.getJobs(types, start, end, asc);
  }

  async getJobCounts(types: JobType[]): Promise<{
    [index: string]: number;
  }> {
    return await this.queue.getJobCounts(...types);
  }

  async getWorkers(): Promise<
    {
      [index: string]: string;
    }[]
  > {
    return await this.queue.getWorkers();
  }

  async getRepeatableJobs(
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<
    {
      key: string;
      name: string;
      id: string;
      endDate: number;
      tz: string;
      cron: string;
      next: number;
    }[]
  > {
    return await this.queue.getRepeatableJobs(start, end, asc);
  }

  async removeRepeatable(
    name: N,
    repeatOpts: RepeatOptions,
    jobId?: string
  ): Promise<any> {
    return await this.queue.removeRepeatable(name, repeatOpts, jobId);
  }

  async removeRepeatableByKey(key: string): Promise<any> {
    return await this.queue.removeRepeatableByKey(key);
  }

  async drain(delayed?: boolean): Promise<void> {
    return await this.queue.drain(delayed);
  }

  async clean(
    grace: number,
    limit: number,
    type?: "completed" | "wait" | "active" | "paused" | "delayed" | "failed"
  ): Promise<any> {
    return await this.queue.clean(grace, limit, type);
  }

  async trimEvents(maxLength: number): Promise<number> {
    return await this.queue.trimEvents(maxLength);
  }

  async getClient(): Promise<RedisClient> {
    return await this.queue.client;
  }

  abstract processor(job: Job<T, R, N>): Promise<R>;
}
