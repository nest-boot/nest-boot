import { Injectable } from "@nestjs/common";
import { DiscoveryService, Reflector } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { Job } from "bullmq";

import { BaseQueue } from "../base.queue";
import { QUEUE_METADATA_KEY } from "../constants";
import { QueueOptions } from "../queue.decorator";

@Injectable()
export class QueueManagerService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector
  ) {}

  getQuene<T extends BaseQueue>(name: string): T {
    const providers = this.getQueueProviders();

    return providers.find(
      (wrapper) =>
        this.reflector.get<QueueOptions>(QUEUE_METADATA_KEY, wrapper.metatype)
          ?.name === name
    )?.instance as T;
  }

  async getJob<T extends Job>(queueName: string, jobId: string): Promise<T> {
    return (await this.getQuene(queueName)?.getJob(jobId)) as T;
  }

  private getQueueProviders(): InstanceWrapper<BaseQueue>[] {
    return this.discoveryService
      .getProviders()
      .filter((wrapper: InstanceWrapper<BaseQueue>) => {
        return wrapper.metatype && wrapper.instance instanceof BaseQueue;
      });
  }
}
