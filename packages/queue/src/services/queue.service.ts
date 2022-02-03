import { Context, getRuntime } from "@nest-boot/common";
import { Redis } from "@nest-boot/redis";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscoveryService, Reflector } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { Job, Queue, QueueScheduler, Worker } from "bullmq";

import { BaseQueue } from "../base.queue";
import { QUEUE_METADATA_KEY } from "../constants";
import { QueueOptions } from "../queue.decorator";

@Injectable()
export class QueueService {
  constructor(
    private readonly configService: ConfigService,
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly redis: Redis
  ) {}

  getQueueProviders(): InstanceWrapper<BaseQueue>[] {
    return this.discoveryService
      .getProviders()
      .filter((wrapper: InstanceWrapper<BaseQueue>) => {
        return wrapper.metatype && wrapper.instance instanceof BaseQueue;
      });
  }

  async init(): Promise<void> {
    const isWorker = getRuntime() === "worker";
    const providers = this.getQueueProviders();

    await Promise.all(
      providers.map((wrapper) =>
        (async () => {
          const queueOptions = this.reflector.get<QueueOptions>(
            QUEUE_METADATA_KEY,
            wrapper.metatype
          );

          // eslint-disable-next-line no-param-reassign
          wrapper.instance.queue = new Queue(queueOptions.name, {
            ...queueOptions,
            connection: this.redis,
          });

          if (
            isWorker ||
            this.configService.get("QUEUE_RUN_IN_MAIN_PROCESS") === "true"
          ) {
            // eslint-disable-next-line no-param-reassign
            wrapper.instance.queueScheduler = new QueueScheduler(
              queueOptions.name,
              {
                ...queueOptions,
                connection: this.redis,
              }
            );

            // eslint-disable-next-line no-param-reassign
            wrapper.instance.worker = new Worker(
              queueOptions.name,
              async (job: Job) => {
                return Context.run({ job }, () =>
                  wrapper.instance.processor(job)
                );
              },
              {
                ...queueOptions,
                connection: this.redis,
              }
            );
          }
        })()
      )
    );
  }
}
