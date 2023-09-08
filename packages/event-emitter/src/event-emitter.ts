import { Injectable } from "@nestjs/common";

import { EventEmitterManager } from "./event-emitter.manager";

@Injectable()
export class EventEmitter {
  constructor(private readonly eventEmitterManager: EventEmitterManager) {}

  public async emit(event: string, data: any): Promise<void> {
    await this.eventEmitterManager.publisher.publish(
      event,
      JSON.stringify(data),
    );
  }
}
