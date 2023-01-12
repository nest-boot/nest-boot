import { DynamicModule, Module, Provider } from "@nestjs/common";
import { Queue } from "bullmq";

import { QueueModuleOptions } from "./interfaces/queue-module-options.interface";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./queue.module-definition";
import { QueueCoreModule } from "./queue-core.module";

@Module({
  imports: [QueueCoreModule],
  exports: [QueueCoreModule],
})
export class QueueModule extends ConfigurableModuleClass {
  static registerQueue(options: typeof OPTIONS_TYPE): DynamicModule {
    return {
      ...this.withQueue(options, super.registerQueue(options)),
    };
  }

  static registerQueueAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return {
      ...this.withQueue(options, super.registerQueueAsync(options)),
    };
  }

  private static withQueue(
    options: typeof OPTIONS_TYPE | typeof ASYNC_OPTIONS_TYPE,
    dynamicModule: DynamicModule
  ): DynamicModule {
    const name = options.name ?? "default";

    const queueProvider: Provider<Queue> = {
      provide: name === "default" ? Queue : `QUEUE_SERVICE[${name}]`,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: QueueModuleOptions) => new Queue(name, options),
    };

    return {
      ...dynamicModule,
      providers: [...(dynamicModule.providers ?? []), queueProvider],
      exports: [...(dynamicModule.exports ?? []), queueProvider],
    };
  }
}
