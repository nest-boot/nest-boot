import { RequestContextModule } from "@nest-boot/request-context";
import { DynamicModule, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { EventEmitter2 } from "eventemitter2";

import { EventSubscribersLoader } from "./event-subscribers.loader";
import { EventsMetadataAccessor } from "./events-metadata.accessor";
import { EventEmitterModuleOptions } from "./interfaces";

@Module({
  imports: [RequestContextModule],
})
export class EventEmitterModule {
  static forRoot(options?: EventEmitterModuleOptions): DynamicModule {
    return {
      global: options?.global ?? true,
      module: EventEmitterModule,
      imports: [DiscoveryModule],
      providers: [
        EventSubscribersLoader,
        EventsMetadataAccessor,
        {
          provide: EventEmitter2,
          useValue: new EventEmitter2(options),
        },
      ],
      exports: [EventEmitter2],
    };
  }
}
