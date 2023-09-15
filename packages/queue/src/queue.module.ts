import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from "@nestjs/common";

import { type QueueModuleOptions } from "./interfaces/queue-module-options.interface";
import { Queue } from "./queue";
import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./queue.module-definition";
import { QueueCoreModule } from "./queue-core.module";
import { getQueueToken } from "./utils/get-queue-token.util";

@Global()
@Module({
  imports: [QueueCoreModule],
  exports: [QueueCoreModule],
})
export class QueueModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    return {
      ...this.withQueue(options, super.register(options)),
    };
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return {
      ...this.withQueue(options, super.registerAsync(options)),
    };
  }

  private static withQueue(
    options: typeof OPTIONS_TYPE | typeof ASYNC_OPTIONS_TYPE,
    dynamicModule: DynamicModule,
  ): DynamicModule {
    const name = options.name ?? "default";

    const queueProvider: Provider<Queue> = {
      provide: name === "default" ? Queue : getQueueToken(name),
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
