import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import {
  createContextId,
  DiscoveryService,
  MetadataScanner,
  Reflector,
} from "@nestjs/core";
import { Injector } from "@nestjs/core/injector/injector";
import IORedis, { Redis } from "ioredis";

import {
  MODULE_OPTIONS_TOKEN,
  SUBSCRIBE_METADATA_KEY,
} from "./event-emitter.module-definition";
import { EventEmitterModuleOptions } from "./event-emitter-module-options.interface";

interface Listener {
  name: string;
  handle: (message: any) => Promise<void>;
}

@Injectable()
export class EventEmitterManager
  implements OnModuleInit, OnApplicationShutdown
{
  publisher: Redis;
  subscriber: Redis;

  private readonly logger = new Logger(EventEmitterManager.name);
  private readonly injector = new Injector();

  readonly listeners: Listener[] = [];

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) options: EventEmitterModuleOptions,
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {
    this.publisher = new IORedis(options);
    this.subscriber = new IORedis(options);
  }

  discoveryListeners(): void {
    this.discoveryService.getProviders().forEach((wrapper) => {
      const { host, instance } = wrapper;

      if (typeof instance === "object" && instance !== null) {
        this.metadataScanner
          .getAllMethodNames(Object.getPrototypeOf(instance))
          .forEach((key) => {
            if (
              typeof host !== "undefined" &&
              typeof instance.constructor.name === "string"
            ) {
              const name = this.reflector.get<string>(
                SUBSCRIBE_METADATA_KEY,
                instance[key],
              );

              if (typeof name !== "undefined") {
                void this.subscriber.subscribe(name);

                const isRequestScoped = !wrapper.isDependencyTreeStatic();

                this.listeners.push({
                  name,
                  handle: isRequestScoped
                    ? async (message) => {
                        const contextId = createContextId();

                        const contextInstance =
                          await this.injector.loadPerContext(
                            instance,
                            host,
                            host.providers,
                            contextId,
                          );

                        return contextInstance[key](message);
                      }
                    : (message) => instance[key](message),
                });

                this.logger.log(`Listener ${name} discovered`);
              }
            }
          });
      }
    });
  }

  onModuleInit(): void {
    this.discoveryListeners();

    this.subscriber.on("message", (name, message) => {
      const data = JSON.parse(message);

      this.listeners.forEach((listener) => {
        if (listener.name === name) {
          const ctx = new RequestContext();
          void RequestContext.run(ctx, async () => {
            await listener.handle(data);
          });
        }
      });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
