import { Context, getRuntime } from "@nest-boot/common";
import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscoveryService, Reflector } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { ConnectionOptions, Job, Queue, QueueScheduler, Worker } from "bullmq";
import pino from "pino";

import { BaseQueue } from "../base.queue";
import { QUEUE_METADATA_KEY } from "../constants";
import { QueueOptions } from "../queue.decorator";

@Injectable()
export class QueueService implements OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);

  private readonly connectionOptions: ConnectionOptions;

  private readonly queues: Queue[] = [];

  private readonly queueSchedulers: QueueScheduler[] = [];

  private readonly workers: Worker[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector
  ) {
    this.connectionOptions = {
      host: configService.get("REDIS_HOST", "localhost"),
      port: +configService.get("REDIS_PORT", "6379"),
      username: configService.get("REDIS_USERNAME"),
      password: configService.get("REDIS_PASSWORD"),
      db: +configService.get("REDIS_DB", "0"),
      tls: configService.get("REDIS_SSL") === "true" && {
        rejectUnauthorized: false,
      },
    };
  }

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
            connection: this.connectionOptions,
          });

          this.queues.push(wrapper.instance.queue);

          if (
            isWorker ||
            this.configService.get("QUEUE_RUN_IN_MAIN_PROCESS") === "true"
          ) {
            // eslint-disable-next-line no-param-reassign
            wrapper.instance.queueScheduler = new QueueScheduler(
              queueOptions.name,
              {
                ...queueOptions,
                connection: this.connectionOptions,
              }
            );

            // eslint-disable-next-line no-param-reassign
            wrapper.instance.worker = new Worker(
              queueOptions.name,
              async (job: Job) => {
                await Context.run(
                  { job, logger: pino().child({ jobId: job.id }) },
                  () => wrapper.instance.processor(job)
                );
              },
              {
                ...queueOptions,
                connection: this.connectionOptions,
              }
            );

            this.queueSchedulers.push(wrapper.instance.queueScheduler);
            this.workers.push(wrapper.instance.worker);
          }
        })()
      )
    );
  }

  async onApplicationShutdown(signal: string) {
    await Promise.all(
      this.workers.map((worker) =>
        (async () => {
          this.logger.log(`Shutting down worker`, {
            signal,
            name: worker.name,
          });

          try {
            await worker.close();
            this.logger.log(`Worker has been shut down`, {
              signal,
              name: worker.name,
            });
          } catch (err) {
            this.logger.error(`Error while shutting down worker`, {
              err,
              signal,
              name: worker.name,
            });
          }
        })()
      )
    );
  }
}
