import { RedisModule } from "@nest-boot/redis";
import {
  DynamicModule,
  Module,
  ModuleMetadata,
  OnModuleInit,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { QueueService } from "./services/queue.service";
import { QueueInfoService } from "./services/queue-info.service";
import { QueueManagerService } from "./services/queue-manager.service";

export interface QueueModuleOptions {
  driver: string;
}

export type QueueModuleAsyncOptions = Pick<ModuleMetadata, "imports">;

@Module({
  imports: [DiscoveryModule, RedisModule],
  providers: [QueueService, QueueManagerService, QueueInfoService],
  exports: [QueueManagerService],
})
export class QueueModule implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly queueInfoService: QueueInfoService
  ) {}

  static registerAsync(options: QueueModuleAsyncOptions): DynamicModule {
    return {
      module: QueueModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers: [QueueService, QueueManagerService, QueueInfoService],
      exports: [QueueManagerService],
    };
  }

  async onModuleInit(): Promise<void> {
    await this.queueService.init();
    this.queueInfoService.init();
  }
}
