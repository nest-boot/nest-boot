import {
  DynamicModule,
  Module,
  ModuleMetadata,
  OnModuleInit,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { QueueService } from "./services/queue.service";

export type QueueModuleAsyncOptions = Pick<ModuleMetadata, "imports">;

@Module({
  imports: [DiscoveryModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule implements OnModuleInit {
  constructor(private readonly queueService: QueueService) {}

  static registerAsync(options: QueueModuleAsyncOptions): DynamicModule {
    return {
      module: QueueModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers: [QueueService],
      exports: [QueueService],
    };
  }

  async onModuleInit(): Promise<void> {
    await this.queueService.init();
  }
}
