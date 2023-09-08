import { HealthCheckRegistry } from "@nest-boot/health-check";
import { Module, type OnModuleInit, Optional } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

import { EventEmitter } from "./event-emitter";
import { EventEmitterHealthIndicator } from "./event-emitter.health-indicator";
import { EventEmitterManager } from "./event-emitter.manager";
import { ConfigurableModuleClass } from "./event-emitter.module-definition";

@Module({
  providers: [
    DiscoveryService,
    EventEmitter,
    EventEmitterManager,
    EventEmitterHealthIndicator,
    MetadataScanner,
  ],
  exports: [EventEmitter],
})
export class EventEmitterModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  constructor(
    private readonly healthIndicator: EventEmitterHealthIndicator,
    @Optional()
    private readonly healthCheckRegistry?: HealthCheckRegistry,
  ) {
    super();
  }

  onModuleInit(): void {
    if (typeof this.healthCheckRegistry !== "undefined") {
      this.healthCheckRegistry.register(
        async () => await this.healthIndicator.pingCheck("event-emitter"),
      );
    }
  }
}
